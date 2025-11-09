import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { LoadingSpinner, VideoIcon, ImageIcon } from './icons';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Result is a data URL: "data:image/jpeg;base64,..."
      // We only need the part after the comma.
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};

const loadingMessages = [
    "Assembling your board of directors...",
    "Warming up the director's chair...",
    "Storyboarding your masterpiece...",
    "Rendering the first frames...",
    "Adding Wolf of Wall Street flair...",
    "Closing the deal on your video...",
    "Polishing the final cut...",
];

const VideoGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [apiKeySelected, setApiKeySelected] = useState<boolean>(false);

  const loadingIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const checkApiKey = async () => {
        if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
            setApiKeySelected(true);
        }
    };
    checkApiKey();
  }, []);

   useEffect(() => {
    if (isLoading) {
      setLoadingMessage(loadingMessages[0]);
      let messageIndex = 1;
      loadingIntervalRef.current = window.setInterval(() => {
        setLoadingMessage(loadingMessages[messageIndex % loadingMessages.length]);
        messageIndex++;
      }, 5000);
    } else if (loadingIntervalRef.current) {
      clearInterval(loadingIntervalRef.current);
      loadingIntervalRef.current = null;
    }

    return () => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
    };
  }, [isLoading]);

  const handleSelectKey = async () => {
    try {
        await window.aistudio.openSelectKey();
        setApiKeySelected(true); // Assume success to avoid race condition
    } catch (e) {
        console.error("Failed to open API key selection:", e);
        setError("Could not open API key selection dialog.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) { // 4MB limit
        setError("Image size cannot exceed 4MB.");
        return;
      }
      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      setError(null);
    }
  };

  const handleGenerateVideo = useCallback(async () => {
    if (!prompt.trim() || !imageFile) {
      setError('Please provide a prompt and an image.');
      return;
    }

    if (!process.env.API_KEY) {
        setError("API key is not configured. Please set the API_KEY environment variable.");
        return;
    }
    
    setIsLoading(true);
    setError(null);
    setVideoUrl(null);
    
    try {
      const imageBase64 = await fileToBase64(imageFile);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: `A cinematic, luxurious, high-energy video of ${prompt}, embodying wealth and power, Wolf of Wall Street style.`,
        image: {
          imageBytes: imageBase64,
          mimeType: imageFile.type,
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9',
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({operation});
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

      if (downloadLink) {
        const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        if (!videoResponse.ok) {
            throw new Error(`Failed to download video: ${videoResponse.statusText}`);
        }
        const videoBlob = await videoResponse.blob();
        const url = URL.createObjectURL(videoBlob);
        setVideoUrl(url);
      } else {
        throw new Error("Video generation completed, but no download link was provided.");
      }

    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(`An error occurred: ${errorMessage}`);
      if (errorMessage.includes("Requested entity was not found")) {
        setError("API key is invalid or not found. Please select a valid key.");
        setApiKeySelected(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [prompt, imageFile]);

  if (!apiKeySelected) {
    return (
        <div className="text-center p-8 bg-slate-900/50 rounded-lg border border-slate-700">
            <h3 className="text-2xl font-bold text-cyan-400 mb-4">API Key Required for Video Generation</h3>
            <p className="text-slate-400 mb-6">
                The high-powered video generation feature requires you to select your own API key. This is a one-time setup.
            </p>
            <p className="text-sm text-slate-500 mb-6">
                For more information on billing, please visit the{' '}
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                    official documentation
                </a>.
            </p>
            <button
                onClick={handleSelectKey}
                className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white font-bold text-lg rounded-lg shadow-lg hover:bg-blue-700 transition-all duration-300"
            >
                Select API Key
            </button>
            {error && <p className="text-red-400 text-sm mt-4" role="alert">{error}</p>}
        </div>
    );
  }

  return (
    <div>
      <p className="text-slate-400 mb-8 text-center sm:text-left">
        Craft a cinematic video from a prompt and a starting image. Set the scene and let the generator do the rest.
      </p>
      <div className="flex flex-col gap-4">
        <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A wolf in a pinstripe suit closing a deal..."
            className="w-full h-24 p-4 bg-slate-900 border-2 border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 text-lg placeholder-slate-500 resize-none"
            disabled={isLoading}
            aria-label="Video generation prompt"
        />

        <div className="w-full">
            <label htmlFor="image-upload" className="block text-slate-400 mb-2">Starting Image:</label>
            <div className="flex items-center gap-4">
                <input
                    id="image-upload"
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isLoading}
                />
                <label htmlFor="image-upload" className={`cursor-pointer flex items-center justify-center gap-2 px-6 py-3 border-2 border-dashed rounded-lg transition-colors ${isLoading ? 'border-slate-700 text-slate-600' : 'border-slate-600 text-slate-300 hover:border-blue-500 hover:text-blue-400'}`}>
                    <ImageIcon/>
                    <span>{imageFile ? "Change Image" : "Select Image"}</span>
                </label>
                {imagePreview && <img src={imagePreview} alt="Preview" className="h-16 w-16 object-cover rounded-lg border-2 border-slate-700" />}
            </div>
             {imageFile && <p className="text-xs text-slate-500 mt-1">{imageFile.name}</p>}
        </div>
        
        <button
            onClick={handleGenerateVideo}
            disabled={isLoading || !prompt.trim() || !imageFile}
            className="sm:w-auto w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white font-bold text-lg rounded-lg shadow-lg hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 disabled:scale-100"
            aria-label="Generate Video"
        >
            {isLoading ? (
                <>
                    <LoadingSpinner />
                    Generating...
                </>
            ) : (
                <>
                    <VideoIcon />
                    Generate Video
                </>
            )}
        </button>
       
        {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

        <div className="mt-6">
            {isLoading && (
                <div className="w-full aspect-video bg-slate-900 rounded-lg border-2 border-slate-700 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <LoadingSpinner />
                        <p className="text-slate-400 text-lg font-semibold">{loadingMessage}</p>
                        <p className="text-slate-500 text-sm">Video generation can take a few minutes. Please wait.</p>
                    </div>
                </div>
            )}
            {!isLoading && videoUrl && (
                <video controls src={videoUrl} className="w-full rounded-lg border-2 border-slate-700" />
            )}
            {!isLoading && !videoUrl && (
                <div className="w-full aspect-video bg-slate-900 rounded-lg border-2 border-slate-700 flex items-center justify-center">
                    <p className="text-slate-500">Your generated video will appear here</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default VideoGenerator;
