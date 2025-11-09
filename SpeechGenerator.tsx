import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { decode, decodeAudioData } from '../services/audioUtils';
import { LoadingSpinner, PlayIcon, ImageIcon } from './icons';

interface GeneratedAudio {
  original: AudioBuffer | null;
  belfort: AudioBuffer | null;
}

interface SpeechGeneratorProps {
  onScriptGenerated: (prompts: string[]) => void;
  onGenerateImagesForScript: () => void;
}


const SpeechGenerator: React.FC<SpeechGeneratorProps> = ({ onScriptGenerated, onGenerateImagesForScript }) => {
  const [textInput, setTextInput] = useState<string>('');
  const [belfortText, setBelfortText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAudio, setGeneratedAudio] = useState<GeneratedAudio>({ original: null, belfort: null });
  const [hasImagePrompts, setHasImagePrompts] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);

  const playAudio = (buffer: AudioBuffer | null) => {
    if (!buffer) return;
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    // Stop any currently playing audio
    audioContextRef.current.close().then(() => {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.start(0);
    });
  };

  const handleGenerateSpeech = useCallback(async () => {
    if (!textInput.trim()) {
      setError('Please enter some text to generate speech.');
      return;
    }

    if (!process.env.API_KEY) {
        setError("API key is not configured. Please set the API_KEY environment variable.");
        return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedAudio({ original: null, belfort: null });
    setBelfortText(null);
    setHasImagePrompts(false);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Step 1: Rewrite the text to sound like Jordan Belfort and add image cues
      const rewritePrompt = `Rewrite the following text to sound like it's being spoken by a high-energy, persuasive, and confident motivational speaker like Jordan Belfort. Use punchy language, rhetorical questions, and a sense of urgency.
      Also, strategically insert up to 10 image cues formatted as [IMAGE #] on their own line. Immediately after each cue, on a new line, provide a concise, powerful image prompt that visually represents the preceding text.
      For example: ... some profound statement.\n[IMAGE 1]\nA golden lion standing on a mountain peak at sunrise.\nThen continue the script...
      Original text: "${textInput}"`;
      
      const textModelResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: rewritePrompt,
      });
      const rewrittenText = textModelResponse.text.trim();
      setBelfortText(rewrittenText);

      // Step 1.5: Extract image prompts from the rewritten text
      const promptRegex = /\[IMAGE \d+\]\s*\n(.*?)\s*\n/g;
      const prompts = [...rewrittenText.matchAll(promptRegex)].map(match => match[1].trim());

      if (prompts.length > 0) {
        onScriptGenerated(prompts);
        setHasImagePrompts(true);
      }

      // Step 2: Generate TTS for both versions (with image prompts stripped from Belfort version)
      const textForSpeech = rewrittenText.replace(/\[IMAGE \d+\]\s*\n.*?\n/g, '');

      const [originalAudioResponse, belfortAudioResponse] = await Promise.all([
        ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: textInput }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
          },
        }),
        ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: `Say with the energetic, confident, and persuasive tone of a world-class motivational speaker like Jordan Belfort: "${textForSpeech}"` }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
          },
        }),
      ]);

      const originalBase64 = originalAudioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      const belfortBase64 = belfortAudioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (originalBase64 && belfortBase64) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        
        const [originalAudioBuffer, belfortAudioBuffer] = await Promise.all([
            decodeAudioData(decode(originalBase64), audioContextRef.current, 24000, 1),
            decodeAudioData(decode(belfortBase64), audioContextRef.current, 24000, 1),
        ]);

        setGeneratedAudio({ original: originalAudioBuffer, belfort: belfortAudioBuffer });
        playAudio(belfortAudioBuffer);
      } else {
        setError('Failed to generate one or both audio versions.');
      }
    } catch (e) {
      console.error(e);
      setError(`An error occurred: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  }, [textInput, onScriptGenerated]);

  const renderBelfortText = () => {
    if (!belfortText) return null;
    // Remove the prompt line for display, keeping the [IMAGE #] cue
    const displayText = belfortText.replace(/(\[IMAGE \d+\])\s*\n.*?\n/g, '$1\n');

    return displayText.split(/(\[IMAGE \d+\])/g).map((part, index) => {
      if (/\[IMAGE \d+\]/.test(part)) {
        return <span key={index} className="block my-2 text-cyan-400 font-bold bg-slate-800/50 px-2 py-1 rounded-md">{part}</span>;
      }
      return part;
    });
  };


  return (
    <div>
        <p className="text-slate-400 mb-8 text-center sm:text-left">
            Enter your text and generate two versions: your original script and one supercharged with Wall Street energy and image cues.
        </p>

        <div className="flex flex-col gap-4">
            <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Sell me this pen..."
                className="w-full h-36 p-4 bg-slate-900 border-2 border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 text-lg placeholder-slate-500 resize-none"
                disabled={isLoading}
                aria-label="Text to generate speech from"
            />
            {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}
            <div className="flex flex-col sm:flex-row gap-4 mt-2">
                <button
                    onClick={handleGenerateSpeech}
                    disabled={isLoading || !textInput.trim()}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white font-bold text-lg rounded-lg shadow-lg hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 disabled:scale-100"
                    aria-label="Generate Speech"
                >
                    {isLoading ? (
                        <>
                            <LoadingSpinner />
                            Generating Versions...
                        </>
                    ) : (
                        <>
                            <PlayIcon />
                            Generate Speech
                        </>
                    )}
                </button>
            </div>
            
            {generatedAudio.belfort && belfortText && !isLoading && (
                <div className="mt-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Original Version */}
                        <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700">
                            <h3 className="text-xl font-bold text-cyan-400 mb-3">Original Version</h3>
                            <p className="text-slate-300 mb-4 h-32 overflow-y-auto">{textInput}</p>
                            <button 
                                onClick={() => playAudio(generatedAudio.original)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-600 transition-colors"
                                aria-label="Play Original Version"
                            >
                                <PlayIcon />
                                Play
                            </button>
                        </div>
                        {/* Belfort Style Version */}
                        <div className="bg-slate-900/50 p-6 rounded-lg border border-blue-500/50 ring-2 ring-blue-500/20">
                            <h3 className="text-xl font-bold text-blue-400 mb-3">Belfort Style</h3>
                            <div className="text-slate-300 mb-4 h-32 overflow-y-auto pr-2">{renderBelfortText()}</div>
                            <button 
                                onClick={() => playAudio(generatedAudio.belfort)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                                aria-label="Play Belfort Style Version"
                            >
                                <PlayIcon />
                                Play
                            </button>
                        </div>
                    </div>
                    {hasImagePrompts && (
                         <button
                            onClick={onGenerateImagesForScript}
                            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-cyan-600 text-white font-bold text-lg rounded-lg shadow-lg hover:bg-cyan-700 transition-all duration-300 transform hover:scale-105"
                            >
                            <ImageIcon />
                            Generate Images for Script
                        </button>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};

export default SpeechGenerator;