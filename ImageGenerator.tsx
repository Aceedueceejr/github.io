import React, { useState, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { LoadingSpinner, ImageIcon } from './icons';

interface ImageGeneratorProps {
  initialPrompt?: string;
}

const ImageGenerator: React.FC<ImageGeneratorProps> = ({ initialPrompt = '' }) => {
  const [prompt, setPrompt] = useState<string>(initialPrompt);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateImage = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt to generate an image.');
      return;
    }

    if (!process.env.API_KEY) {
        setError("API key is not configured. Please set the API_KEY environment variable.");
        return;
    }

    setIsLoading(true);
    setError(null);
    setImageUrls([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const themedPrompt = `A cinematic, luxurious, high-energy photograph of ${prompt}, embodying wealth and power, Wolf of Wall Street style.`;

      const imagePromises = Array.from({ length: 5 }).map(() =>
        ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [{ text: themedPrompt }],
          },
          config: {
            responseModalities: [Modality.IMAGE],
          },
        })
      );

      const responses = await Promise.all(imagePromises);

      const urls = responses.map(response => {
        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part && part.inlineData) {
          const base64ImageBytes: string = part.inlineData.data;
          return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
        }
        return null;
      }).filter((url): url is string => url !== null);

      if (urls.length > 0) {
        setImageUrls(urls);
        if (urls.length < 5) {
            setError(`Successfully generated ${urls.length} out of 5 images. Some generations may have been blocked.`);
        }
      } else {
        setError('Failed to generate any images. The model may have returned an empty response or been blocked.');
      }

    } catch (e) {
      console.error(e);
      setError(`An error occurred: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  }, [prompt]);

  return (
    <div>
      <p className="text-slate-400 mb-8 text-center sm:text-left">
        Describe a scene and generate 5 luxurious, high-energy image versions inspired by the Wolf of Wall Street.
      </p>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
            <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A golden wolf in a pinstripe suit..."
                className="flex-grow p-4 bg-slate-900 border-2 border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 text-lg placeholder-slate-500"
                disabled={isLoading}
                aria-label="Image generation prompt"
                onKeyDown={(e) => e.key === 'Enter' && handleGenerateImage()}
            />
            <button
                onClick={handleGenerateImage}
                disabled={isLoading || !prompt.trim()}
                className="sm:w-auto w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white font-bold text-lg rounded-lg shadow-lg hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 disabled:scale-100"
                aria-label="Generate Image"
            >
                {isLoading ? (
                    <>
                        <LoadingSpinner />
                        Generating...
                    </>
                ) : (
                    <>
                        <ImageIcon />
                        Generate Images
                    </>
                )}
            </button>
        </div>
        {error && (
            <p className={`text-sm mt-2 ${error.startsWith('Success') ? 'text-yellow-400' : 'text-red-400'}`} role="alert">
                {error}
            </p>
        )}

        <div className="mt-6">
            {isLoading && (
                <div className="w-full aspect-video bg-slate-900 rounded-lg border-2 border-slate-700 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                        <LoadingSpinner />
                        <p className="text-slate-500">Generating 5 versions...</p>
                    </div>
                </div>
            )}
            {!isLoading && imageUrls.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                    {imageUrls.map((url, index) => (
                        <div key={index} className={`group relative rounded-lg overflow-hidden border-2 border-slate-700 aspect-square
                            ${index < 2 ? 'sm:col-span-3' : 'sm:col-span-2'}`
                        }>
                            <img src={url} alt={`${prompt} - version ${index + 1}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        </div>
                    ))}
                </div>
            )}
            {!isLoading && imageUrls.length === 0 && (
                <div className="w-full aspect-video bg-slate-900 rounded-lg border-2 border-slate-700 flex items-center justify-center">
                    <p className="text-slate-500">Your 5 generated image versions will appear here</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ImageGenerator;