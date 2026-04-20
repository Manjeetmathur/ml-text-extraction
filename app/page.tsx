'use client';

import { useState, useRef } from 'react';

const PATTERNS = [
  { label: 'None / Custom Text Only', value: '' },
  { label: 'PAN Card (Permanent Account Number)', value: '/[A-Z]{5}[0-9]{4}[A-Z]{1}/i' },
  { label: 'Aadhar Card (12-digit number)', value: '/\\d{4}\\s\\d{4}\\s\\d{4}/' },
  { label: 'Voter ID (EPIC Number)', value: '/[A-Z]{3}[0-9]{7}/i' },
  { label: 'Passport (Indian Format)', value: '/[A-Z][0-9]{7}/i' },
  { label: 'Driving License (Standard)', value: '/[A-Z]{2}[0-9]{13}/i' },
  { label: 'Phone Number (10-digit Indian)', value: '/\\d{10}/' },
  { label: 'Date of Birth (DD/MM/YYYY)', value: '/\\d{2}\\/\\d{2}\\/\\d{4}/' },
];

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [searchText, setSearchText] = useState('');
  const [regexText, setRegexText] = useState('');
  const [loading, setLoading] = useState(false);
  const [debug, setDebug] = useState(false);
  const [result, setResult] = useState<{ 
    found: boolean, 
    textFound: boolean, 
    regexFound: boolean, 
    matchedText: string | null, 
    matchedRegex: string | null,
    rawText: string,
    processedImage?: string
  } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image || (!searchText && !regexText)) return;

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('image', image);
    formData.append('text', searchText);
    formData.append('regex', regexText);

    try {
      const response = await fetch('http://localhost:3001/api/ocr', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.error || 'Failed to process image');
        return;
      }
      setResult(data);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to process OCR request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
        <div>
          <h1>VisionSearch AI</h1>
          <p className="subtitle" style={{textAlign: 'left', marginBottom: 0}}>Smart Document Verification</p>
        </div>
        <button 
          type="button" 
          className="chip" 
          onClick={() => setDebug(!debug)}
          style={{
            borderColor: debug ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
            background: debug ? 'rgba(99, 102, 241, 0.1)' : 'transparent'
          }}
        >
          {debug ? 'Hide Debug' : 'Debug OCR'}
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Step 1: Upload Document</label>
          <div 
            className="upload-area" 
            onClick={() => fileInputRef.current?.click()}
          >
            {preview ? (
              <img src={preview} alt="Preview" className="preview-img" />
            ) : (
              <div style={{padding: '1rem'}}>
                <svg style={{marginBottom: '10px', opacity: 0.5}} width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                <p style={{color: 'var(--text-muted)'}}>Drag or click to upload</p>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageChange} 
              accept="image/*" 
              hidden 
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="searchText">Step 2: Verify specific info (Optional)</label>
          <input 
            id="searchText"
            type="text" 
            className="input-field" 
            placeholder="e.g., Name to verify" 
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="regexSelect">Step 3: Auto-detect ID Pattern</label>
          <select 
            id="regexSelect"
            className="input-field"
            value={regexText}
            onChange={(e) => setRegexText(e.target.value)}
            style={{appearance: 'none', cursor: 'pointer', background: 'rgba(15, 23, 42, 0.8)'}}
          >
            {PATTERNS.map((p) => (
              <option key={p.value} value={p.value} style={{background: '#0f172a', color: '#fff'}}>
                {p.label}
              </option>
            ))}
          </select>
          <p style={{fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px'}}>
            Select a document type to automatically detect and extract ID numbers.
          </p>
        </div>


        <button 
          type="submit" 
          className="btn" 
          disabled={loading || !image || (!searchText && !regexText)}
        >
          {loading ? (
            <>
              <span className="loader"></span>
              Analyzing image...
            </>
          ) : (
            'Check for matches'
          )}
        </button>
      </form>

      {result && (
        <div className={`result show ${result.found ? 'found' : 'not-found'}`}>
          <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
              {result.found ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
              )}
              <span style={{fontWeight: 'bold'}}>{result.found ? 'Match Found' : 'No Results'}</span>
            </div>

            <div className="results-grid">
              {result.textFound && (
                <div className="match-item">
                  <span className="match-label">Literal Found:</span>
                  <div className="matched-badge">{result.matchedText}</div>
                </div>
              )}
              {result.regexFound && (
                <div className="match-item">
                  <span className="match-label">Pattern Found:</span>
                  <div className="matched-badge">{result.matchedRegex}</div>
                </div>
              )}
            </div>
            
            {!result.found && (
              <p style={{fontSize: '0.9rem', opacity: 0.8}}>
                No matches were identified for your search terms.
              </p>
            )}

            {debug && (
              <div className="debug-container">
                {result.processedImage && (
                  <div style={{marginBottom: '15px'}}>
                    <span className="match-label">AI View (Processed Image):</span>
                    <img 
                      src={result.processedImage} 
                      alt="AI View" 
                      style={{width: '100%', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', marginTop: '8px'}} 
                    />
                  </div>
                )}
                <span className="match-label">Raw OCR Output:</span>
                <pre className="raw-text">{result.rawText || 'No text extracted'}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
