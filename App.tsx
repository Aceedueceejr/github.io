import React, { useState } from 'react';
import { WolfIcon } from './components/icons';
import SpeechGenerator from './components/SpeechGenerator';
import ImageGenerator from './components/ImageGenerator';
import VideoGenerator from './components/VideoGenerator';

type Tab = 'speech' | 'image' | 'video';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('speech');
  const [imagePrompts, setImagePrompts] = useState<string[]>([]);
  const [initialImagePrompt, setInitialImagePrompt] = useState<string>('');
  const [imageGenKey, setImageGenKey] = useState(Date.now());


  const handleScriptGenerated = (prompts: string[]) => {
    setImagePrompts(prompts);
  };

  const handleGenerateImagesForScript = () => {
    if (imagePrompts.length > 0) {
      // For now, just use the first prompt.
      // A more advanced implementation could show a list of prompts.
      setInitialImagePrompt(imagePrompts[0]); 
      setActiveTab('image');
      setImageGenKey(Date.now()); // Force re-mount of ImageGenerator
    }
  };


  const renderTabButton = (tab: Tab, label: string) => (
    <button 
        onClick={() => setActiveTab(tab)}
        className={`px-4 py-2 text-lg font-semibold transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-t-md ${activeTab === tab ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
        aria-pressed={activeTab === tab}
    >
        {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-2xl bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl shadow-blue-500/10 border border-slate-700 overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 text-center sm:text-left">
              Belfort Content Suite
            </h1>
            <WolfIcon className="h-12 w-12 text-blue-400" />
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-700 mb-6">
            {renderTabButton('speech', 'Speech Generator')}
            {renderTabButton('image', 'Image Generator')}
            {renderTabButton('video', 'Video Generator')}
          </div>
            
          {/* Conditional Content */}
          <div role="tabpanel" hidden={activeTab !== 'speech'}>
            {activeTab === 'speech' && <SpeechGenerator onScriptGenerated={handleScriptGenerated} onGenerateImagesForScript={handleGenerateImagesForScript} />}
          </div>
          <div role="tabpanel" hidden={activeTab !== 'image'}>
            {activeTab === 'image' && <ImageGenerator key={imageGenKey} initialPrompt={initialImagePrompt} />}
          </div>
           <div role="tabpanel" hidden={activeTab !== 'video'}>
            {activeTab === 'video' && <VideoGenerator />}
          </div>
        </div>
      </div>
       <footer className="text-center mt-8 text-slate-500 text-sm">
        <p>Powered by Gemini. For entertainment purposes only.</p>
      </footer>
    </div>
  );
};

export default App;