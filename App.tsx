import React, { useState, useRef } from 'react';
import { ShieldCheck, Layers, BookOpen, Menu, X, RotateCcw, Upload, FileText, Trash2, FileCheck, Library, Plus, Cloud, Cpu } from 'lucide-react';
import ClaimsProcessor from './components/ClaimsProcessor';
import ChatBot from './components/ChatBot';
import { SAMPLE_DOCUMENTS } from './constants';
import { PolicyDocument } from './types';

const App: React.FC = () => {
  const [showPolicies, setShowPolicies] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [appMode, setAppMode] = useState<'cloud' | 'local'>('cloud');
  
  // State for Knowledge Base (Array of Documents)
  const [documents, setDocuments] = useState<PolicyDocument[]>(SAMPLE_DOCUMENTS);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const resetKnowledgeBase = () => {
    if (window.confirm("This will clear all custom documents and reset to the sample. Continue?")) {
      setDocuments(SAMPLE_DOCUMENTS);
    }
  };

  const removeDocument = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach(processFile);
    }
    // Reset input so same file can be selected again if needed
    if (event.target.value) event.target.value = '';
  };

  const processFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      alert(`Skipped "${file.name}": Only PDF documents are supported.`);
      return;
    }

    const MAX_SIZE_MB = 20;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`Skipped "${file.name}": File is too large (>20MB).`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Content = (e.target?.result as string).split(',')[1];
      const newDoc: PolicyDocument = {
        id: Date.now().toString() + Math.random().toString(),
        name: file.name,
        type: 'file',
        content: base64Content,
        mimeType: file.type
      };
      setDocuments(prev => [...prev, newDoc]);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files) {
      Array.from(files).forEach(processFile);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg text-white">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700">
                ClaimGuard AI
              </h1>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-6">
                
               {/* Mode Switcher */}
               <div className="bg-slate-100 rounded-lg p-1 flex items-center">
                  <button 
                    onClick={() => setAppMode('cloud')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${appMode === 'cloud' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    Cloud API
                  </button>
                  <button 
                    onClick={() => setAppMode('local')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${appMode === 'local' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    Local Models
                  </button>
               </div>

               <div className="w-px h-6 bg-slate-200 mx-2"></div>

               <button 
                onClick={() => setShowPolicies(false)}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${!showPolicies ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
               >
                 <Layers className="w-4 h-4" />
                 Dashboard
               </button>
               <button 
                onClick={() => setShowPolicies(true)}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${showPolicies ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
               >
                 <Library className="w-4 h-4" />
                 KB ({documents.length})
               </button>
            </div>

             {/* Mobile Menu Button */}
            <div className="flex items-center md:hidden">
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
                className="text-slate-500 hover:text-slate-700 p-2"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 px-4 py-2 space-y-2">
            <div className="flex gap-2 p-2 bg-slate-50 rounded-lg mb-2">
                 <button 
                    onClick={() => setAppMode('cloud')}
                    className={`flex-1 flex justify-center items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${appMode === 'cloud' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    <Cloud className="w-4 h-4" /> Cloud
                  </button>
                  <button 
                    onClick={() => setAppMode('local')}
                    className={`flex-1 flex justify-center items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${appMode === 'local' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    <Cpu className="w-4 h-4" /> Local
                  </button>
            </div>
            <button 
                onClick={() => { setShowPolicies(false); setMobileMenuOpen(false); }}
                className={`block w-full text-left px-4 py-3 rounded-lg ${!showPolicies ? 'bg-blue-50 text-blue-700' : 'text-slate-600'}`}
               >
                 Processing Dashboard
             </button>
             <button 
                onClick={() => { setShowPolicies(true); setMobileMenuOpen(false); }}
                className={`block w-full text-left px-4 py-3 rounded-lg ${showPolicies ? 'bg-blue-50 text-blue-700' : 'text-slate-600'}`}
               >
                 Knowledge Base
             </button>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full py-8">
        {showPolicies ? (
          <div className="max-w-5xl mx-auto p-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[75vh]">
              {/* Header */}
              <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center flex-shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Library className="w-5 h-5 text-indigo-600" />
                    Knowledge Base Manager
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">
                    Upload multiple policies (20-30 documents). The AI will effectively "learn" all of them instantly.
                  </p>
                </div>
                <div className="flex gap-2">
                   <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Document
                  </button>
                  <button 
                    onClick={resetKnowledgeBase}
                    className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" /> Reset
                  </button>
                </div>
              </div>

              {/* Document List & Drop Zone */}
              <div className="flex-1 p-6 bg-slate-50/50 flex flex-col">
                
                {/* Documents Grid */}
                {documents.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    {documents.map(doc => (
                      <div key={doc.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between group hover:border-blue-300 transition-colors">
                        <div className="flex items-start gap-3 overflow-hidden">
                           <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${doc.type === 'file' ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-500'}`}>
                             {doc.type === 'file' ? <FileText className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                           </div>
                           <div className="min-w-0">
                             <h4 className="font-medium text-sm text-slate-900 truncate" title={doc.name}>{doc.name}</h4>
                             <p className="text-xs text-slate-500">{doc.type === 'file' ? 'PDF Document' : 'Text Sample'}</p>
                           </div>
                        </div>
                        <button 
                          onClick={() => removeDocument(doc.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors p-1"
                          title="Remove document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                   <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
                      <Library className="w-12 h-12 mb-3 opacity-20" />
                      <p>Knowledge Base is empty.</p>
                   </div>
                )}

                {/* Drop Zone */}
                <div 
                  className={`mt-auto border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-white bg-slate-100/50'}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-12 h-12 bg-white text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-slate-800">Upload More Documents</h3>
                  <p className="text-slate-500 text-sm max-w-xs mx-auto mt-1">
                    Drag and drop PDF files here to expand the AI's knowledge base.
                  </p>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="application/pdf"
                    multiple // Allow multiple files
                    onChange={handleFileUpload}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <ClaimsProcessor documents={documents} mode={appMode} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-400 text-sm">
          <p>© 2024 ClaimGuard AI. Powered by Gemini 2.5 Flash & TensorFlow.js (USE).</p>
        </div>
      </footer>

      {/* Floating Chat Bot */}
      <ChatBot documents={documents} />
    </div>
  );
};

export default App;