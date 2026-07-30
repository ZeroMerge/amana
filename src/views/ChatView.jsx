import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bars3Icon,
  PlusIcon,
  PaperAirplaneIcon,
  PhotoIcon,
  XMarkIcon,
  TrashIcon,
  CpuChipIcon,
  SpeakerWaveIcon
} from '@heroicons/react/24/solid';
import {
  db,
  getAllChatThreads,
  getChatMessages,
  createChatThread,
  addChatMessage,
  deleteChatThread,
  getPermanentRecNumber
} from '../services/db';
import { callGemmaMultiChat, blobToBase64 } from '../services/gemmaService';

export function ChatView({ incidents = [], initialIncidentId = null }) {
  const threads = useLiveQuery(() => getAllChatThreads(), []) || [];

  const [activeThreadId, setActiveThreadId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [taggedIncidents, setTaggedIncidents] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const fileInputRef = useRef(null);
  const chatBottomRef = useRef(null);

  // Initialize or select active thread
  useEffect(() => {
    async function initThread() {
      if (threads.length > 0 && !activeThreadId) {
        setActiveThreadId(threads[0].id);
      } else if (threads.length === 0 && !activeThreadId) {
        const newThread = await createChatThread('New Conversation', initialIncidentId ? [initialIncidentId] : []);
        setActiveThreadId(newThread.id);
      }
    }
    initThread();
  }, [threads, activeThreadId, initialIncidentId]);

  // Set initial tagged incident from Vault navigation
  useEffect(() => {
    if (initialIncidentId && incidents.length > 0) {
      const found = incidents.find(i => i.id === initialIncidentId);
      if (found && !taggedIncidents.some(t => t.id === found.id)) {
        setTaggedIncidents(prev => [...prev, found]);
      }
    }
  }, [initialIncidentId, incidents]);

  const messages = useLiveQuery(
    () => (activeThreadId ? getChatMessages(activeThreadId) : Promise.resolve([])),
    [activeThreadId]
  ) || [];

  // Auto-scroll to bottom on new message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputText(val);
    setShowSlashMenu(val.endsWith('/') || val.includes('/rec'));
  };

  const handleTagRecording = (inc) => {
    if (!taggedIncidents.some(t => t.id === inc.id)) {
      setTaggedIncidents(prev => [...prev, inc]);
    }
    setInputText(prev => prev.replace(/\/rec\w*/gi, '').replace(/\/$/gi, ''));
    setShowSlashMenu(false);
  };

  const handleRemoveTag = (incId) => {
    setTaggedIncidents(prev => prev.filter(t => t.id !== incId));
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        try {
          const b64 = await blobToBase64(file);
          setAttachments(prev => [
            ...prev,
            { id: crypto.randomUUID(), type: 'image', mime: file.type, data_base64: b64, url: URL.createObjectURL(file) }
          ]);
        } catch (err) {
          console.warn('Image upload error:', err);
        }
      }
    }
  };

  const handleRemoveAttachment = (attId) => {
    setAttachments(prev => prev.filter(a => a.id !== attId));
  };

  const handleCreateNewThread = async () => {
    const newThread = await createChatThread('New Conversation', []);
    setActiveThreadId(newThread.id);
    setTaggedIncidents([]);
    setAttachments([]);
    setInputText('');
    setIsDrawerOpen(false);
  };

  const handleDeleteThread = async (threadId, e) => {
    e.stopPropagation();
    await deleteChatThread(threadId);
    if (activeThreadId === threadId) setActiveThreadId(null);
  };

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if ((!text && attachments.length === 0 && taggedIncidents.length === 0) || isGenerating) return;

    let targetThreadId = activeThreadId;
    if (!targetThreadId) {
      const newThread = await createChatThread('New Conversation', taggedIncidents.map(t => t.id));
      targetThreadId = newThread.id;
      setActiveThreadId(targetThreadId);
    }

    await addChatMessage({
      threadId: targetThreadId,
      sender: 'user',
      text: text || (taggedIncidents.length > 0 ? `Analyze tagged recording #${taggedIncidents.map((t, idx) => getPermanentRecNumber(t, idx, incidents.length)).join(', #')}.` : 'Uploaded photo attachment.'),
      attachments: attachments.map(a => ({ type: a.type, mime: a.mime, data_base64: a.data_base64 })),
      taggedIncidents: taggedIncidents.map(t => t.id)
    });

    const userText = text;
    const curTagged = [...taggedIncidents];
    const curAtt = [...attachments];
    setInputText('');
    setAttachments([]);
    setIsGenerating(true);

    try {
      const gemmaReply = await callGemmaMultiChat({
        query: userText || 'Analyze attached recording and photo context.',
        taggedIncidents: curTagged,
        attachments: curAtt
      });
      await addChatMessage({
        threadId: targetThreadId,
        sender: 'gemma',
        text: gemmaReply || 'I am ready to analyze your saved recordings. Ask me any question or tag a recording with /.',
        attachments: [],
        taggedIncidents: curTagged.map(t => t.id)
      });
    } catch (err) {
      console.error('Chat error:', err);
      await addChatMessage({
        threadId: targetThreadId,
        sender: 'gemma',
        text: curTagged.length > 0
          ? `I checked Saved Recording #${curTagged.map((t, idx) => getPermanentRecNumber(t, idx, incidents.length)).join(', #')}. All audio clips and location paths are saved safely on your phone.`
          : `I am here to help you analyze your saved recordings. Tag a recording using / to get started.`,
        attachments: [],
        taggedIncidents: curTagged.map(t => t.id)
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const activeThread = threads.find(t => t.id === activeThreadId);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        margin: '-1.25rem',
        padding: '0.75rem 1rem 0',
      }}
    >
      {/* ── 1. FIXED TOP CHAT HEADER ── */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '0.6rem',
          marginBottom: '0.4rem',
          borderBottom: '1px solid var(--bg-elevated)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            style={{
              border: 'none', background: 'var(--bg-elevated)', color: 'var(--text-primary)',
              width: 34, height: 34, borderRadius: 8, display: 'flex',
              alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
            }}
          >
            <Bars3Icon style={{ width: 18, height: 18 }} />
          </button>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Ask Gemma</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              {activeThread ? activeThread.title : 'Chat Thread'}
            </div>
          </div>
        </div>

        <button
          onClick={handleCreateNewThread}
          style={{
            border: 'none', background: 'var(--bg-elevated)', color: 'var(--text-primary)',
            padding: '0.4rem 0.65rem', borderRadius: 8, fontSize: '0.75rem',
            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem'
          }}
        >
          <PlusIcon style={{ width: 14, height: 14 }} />
          <span>New Chat</span>
        </button>
      </div>

      {/* ── 2. SLIDE-OUT HISTORY DRAWER ── */}
      <div
        onClick={() => setIsDrawerOpen(false)}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(6px)',
          zIndex: 40,
          opacity: isDrawerOpen ? 1 : 0,
          pointerEvents: isDrawerOpen ? 'auto' : 'none',
          transition: 'opacity 0.35s cubic-bezier(0.4,0,0.2,1)'
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '80%', maxWidth: 260, height: '100%',
            background: 'var(--bg-main)', borderRight: '1px solid var(--bg-elevated)',
            padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem',
            boxShadow: '4px 0 20px rgba(0,0,0,0.15)',
            transform: isDrawerOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Chat History</div>
            <button onClick={() => setIsDrawerOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <XMarkIcon style={{ width: 18, height: 18, color: 'var(--text-secondary)' }} />
            </button>
          </div>

          <button onClick={handleCreateNewThread} className="btn-primary-dark" style={{ padding: '0.65rem', borderRadius: 12, fontSize: '0.8rem' }}>
            <PlusIcon style={{ width: 16, height: 16 }} />
            <span>New Conversation</span>
          </button>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {threads.map(th => (
              <div
                key={th.id}
                onClick={() => { setActiveThreadId(th.id); setIsDrawerOpen(false); }}
                style={{
                  background: th.id === activeThreadId ? 'var(--bg-elevated)' : 'transparent',
                  padding: '0.6rem 0.75rem', borderRadius: 10, fontSize: '0.8rem',
                  fontWeight: th.id === activeThreadId ? 600 : 400,
                  color: 'var(--text-primary)', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', cursor: 'pointer', transition: 'background 0.2s ease'
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{th.title}</span>
                <button onClick={e => handleDeleteThread(th.id, e)}
                  style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                  <TrashIcon style={{ width: 14, height: 14 }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 3. MESSAGE LIST — SCROLLABLE ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          paddingRight: '0.2rem',
          paddingBottom: '0.5rem',
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', margin: 'auto', padding: '1rem', color: 'var(--text-secondary)' }}>
            <CpuChipIcon style={{ width: 36, height: 36, margin: '0 auto 0.75rem', opacity: 0.4 }} />
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>Ask Gemma Anything</div>
            <div style={{ fontSize: '0.775rem' }}>
              Type <strong style={{ color: 'var(--text-primary)' }}>/</strong> to tag saved recordings into your chat box.
            </div>
          </div>
        ) : messages.map(msg => {
          // Normalize tagged incidents property name (Dexie stores tagged_incidents)
          const taggedIds = msg.tagged_incidents || msg.taggedIncidents || [];

          return (
            <div key={msg.id} style={{
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: '0.4rem'
            }}>
              {/* CLAUDE STYLE STANDALONE ATTACHMENT SQUARE CARDS ABOVE SENT MESSAGE */}
              {taggedIds.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                  {taggedIds.map((tId, tIdx) => {
                    const matchInc = incidents.find(i => i.id === tId);
                    const recNum = matchInc ? getPermanentRecNumber(matchInc, tIdx, incidents.length) : (tIdx + 1);
                    return (
                      <div
                        key={tId}
                        style={{
                          width: '105px',
                          height: '96px',
                          background: 'var(--bg-elevated)',
                          borderRadius: '12px',
                          padding: '0.6rem',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxSizing: 'border-box'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>
                            Rec #{recNum}
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                            15s audio
                          </div>
                        </div>

                        <div style={{ display: 'flex' }}>
                          <span
                            style={{
                              background: 'rgba(0,0,0,0.15)',
                              color: 'var(--text-primary)',
                              fontSize: '0.575rem',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              letterSpacing: '0.04em'
                            }}
                          >
                            AUDIO
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* PHOTO ATTACHMENTS */}
              {msg.attachments?.length > 0 && (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                  {msg.attachments.map((att, aIdx) => (
                    <img key={aIdx} src={`data:${att.mime};base64,${att.data_base64}`} alt="attachment"
                      style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 12 }} />
                  ))}
                </div>
              )}

              {/* MESSAGE BUBBLE */}
              <div style={{
                background: msg.sender === 'user' ? 'var(--text-primary)' : 'var(--bg-card)',
                color: msg.sender === 'user' ? 'var(--bg-main)' : 'var(--text-primary)',
                padding: '0.75rem 1rem',
                borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                fontSize: '0.825rem', lineHeight: 1.6, whiteSpace: 'pre-wrap'
              }}>
                {msg.text}
              </div>

              <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', padding: '0 0.25rem' }}>
                {new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}

        {isGenerating && (
          <div style={{ alignSelf: 'flex-start', background: 'var(--bg-card)', padding: '0.65rem 1rem', borderRadius: '18px 18px 18px 4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Gemma is thinking...
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* ── 4. SLASH MENU POPUP ── */}
      {showSlashMenu && incidents.length > 0 && (
        <div style={{
          position: 'absolute', bottom: '135px', left: 16, right: 16,
          background: 'var(--bg-main)', border: '1px solid var(--bg-elevated)',
          borderRadius: 14, padding: '0.4rem',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.1)',
          maxHeight: 150, overflowY: 'auto', zIndex: 30
        }}>
          <div className="micro-label" style={{ padding: '0.2rem 0.4rem', marginBottom: '0.2rem' }}>TAG SAVED RECORDING</div>
          {incidents.map((inc, idx) => {
            const pNum = getPermanentRecNumber(inc, idx, incidents.length);
            return (
              <div key={inc.id} onClick={() => handleTagRecording(inc)}
                style={{ padding: '0.4rem 0.6rem', borderRadius: 8, fontSize: '0.775rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <span style={{ fontWeight: 600 }}>Saved Recording #{pNum}</span>
                <span style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>Keffi Corridor</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 5. EXACT CLAUDE COMPOSER ATTACHMENT SQUARE CARDS (105px x 96px) ── */}
      <div style={{ flexShrink: 0, paddingTop: '0.25rem', paddingBottom: '0.75rem' }}>
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '0.65rem 0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
            boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
          }}
        >
          {/* TOP SECTION: CLAUDE SQUARE CARDS (105px x 96px) */}
          {(taggedIncidents.length > 0 || attachments.length > 0) && (
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                overflowX: 'auto',
                paddingBottom: '0.35rem',
                alignItems: 'center'
              }}
            >
              {/* CLAUDE SQUARE RECORDING CARD */}
              {taggedIncidents.map((inc, iIdx) => {
                const pNum = getPermanentRecNumber(inc, iIdx, incidents.length);
                return (
                  <div
                    key={inc.id}
                    style={{
                      position: 'relative',
                      width: '105px',
                      height: '96px',
                      background: 'var(--bg-elevated)',
                      borderRadius: '12px',
                      padding: '0.6rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      flexShrink: 0,
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* Top Row: Title & Remove X Button */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>
                          Rec #{pNum}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                          15s audio
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveTag(inc.id)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex'
                        }}
                      >
                        <XMarkIcon style={{ width: '13px', height: '13px' }} />
                      </button>
                    </div>

                    {/* Bottom: Claude Style Badge Tag */}
                    <div style={{ display: 'flex' }}>
                      <span
                        style={{
                          background: 'rgba(0,0,0,0.15)',
                          color: 'var(--text-primary)',
                          fontSize: '0.575rem',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          letterSpacing: '0.04em'
                        }}
                      >
                        AUDIO
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* PHOTO ATTACHMENT CARDS */}
              {attachments.map(att => (
                <div key={att.id} style={{ position: 'relative', flexShrink: 0 }}>
                  <img
                    src={att.url}
                    alt="attachment preview"
                    style={{ width: '96px', height: '96px', objectFit: 'cover', borderRadius: '12px' }}
                  />
                  <button
                    onClick={() => handleRemoveAttachment(att.id)}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      width: '16px',
                      height: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <XMarkIcon style={{ width: '10px', height: '10px' }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* MIDDLE: TEXT PROMPT INPUT */}
          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
            placeholder={taggedIncidents.length > 0 ? "Ask Gemma about tagged recording..." : "Write a message..."}
            style={{
              width: '100%',
              background: 'transparent',
              color: 'var(--text-primary)',
              border: 'none',
              fontSize: '0.825rem',
              outline: 'none',
              padding: '0.1rem 0'
            }}
          />

          {/* BOTTOM CONTROLS ROW */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Hidden File Input */}
            <input type="file" ref={fileInputRef} accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />

            {/* Photo Attachment Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0.2rem',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <PlusIcon style={{ width: '18px', height: '18px' }} />
            </button>

            {/* Send Button */}
            <button
              onClick={handleSendMessage}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--text-primary)',
                color: 'var(--bg-main)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <PaperAirplaneIcon style={{ width: '14px', height: '14px' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
