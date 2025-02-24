import { useState, ChangeEvent } from 'react';
import { Button } from './components/ui/button';
import { Upload, Moon, Sun, FileText } from 'lucide-react';

function App() {
  const [extractedText, setExtractedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [language, setLanguage] = useState<string>('de-DE');
  const [darkMode, setDarkMode] = useState<boolean>(false);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError('');
    setExtractedText('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', language);

    try {
      const response = await fetch('http://localhost:8000/extract-audio', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to process the video');
      }

      setExtractedText(data.text);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to process the video. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen ${
        darkMode ? 'bg-gray-900 text-white' : 'bg-[#C9D9CD]/50 text-black'
      } font-sans flex items-center justify-center p-8 transition-all`}
    >
      <div className='absolute top-4 right-4'>
        <Button
          variant='ghost'
          onClick={() => setDarkMode(!darkMode)}
          className='p-2 rounded-full transition-all'
        >
          {darkMode ? (
            <Sun className='h-5 w-5' />
          ) : (
            <Moon className='h-5 w-5' />
          )}
        </Button>
      </div>

      <div className='w-full lg:max-w-6xl grid lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1 gap-8'>
        {/* Upload Section */}
        <div className='flex items-center justify-center'>
          <div
            className={`p-6 rounded-lg shadow-lg max-w-md w-full ${
              darkMode ? 'bg-gray-800' : 'bg-[#294744]'
            }`}
          >
            <div className='flex flex-col items-center justify-center'>
              <h1 className='text-2xl font-bold text-white mb-2 gap-2 flex-wrap'>
                <span>Extract Speech, Read with Ease!</span>
              </h1>
              <p className='text-gray-300 mb-6 justify-center'>
                Can't catch every word? Let's get the text for you!
              </p>
            </div>

            {/* Language Selector */}
            <div className='flex items-center gap-4 mb-4'>
              <label
                htmlFor='language'
                className='text-gray-300 whitespace-nowrap'
              >
                Language:
              </label>
              <select
                id='language'
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className='flex-1 p-2 rounded-md border border-gray-500 bg-white text-black dark:bg-gray-700 dark:text-white'
              >
                <option value='en-US'>English</option>
                <option value='fr-FR'>French</option>
                <option value='de-DE'>German</option>
                <option value='it-IT'>Italian</option>
                <option value='ja-JP'>Japanese</option>
                <option value='ko-KR'>Korean</option>
                <option value='es-ES'>Spanish</option>
              </select>
            </div>

            {/* File Upload with Drag and Drop */}
            <div className='relative border-2 border-dashed border-gray-500 p-6 rounded-lg text-center'>
              <input
                type='file'
                accept='audio/*,video/*'
                onChange={handleFileUpload}
                className='absolute inset-0 w-full h-full opacity-0 cursor-pointer'
              />
              <Upload className='h-8 w-8 mx-auto text-gray-300' />
              <p className='text-gray-300 mt-2'>Drag and drop or</p>
              <Button className='mt-2 flex items-center gap-2 mx-auto'>
                <Upload className='h-4 w-4' />
                Choose a file
              </Button>
            </div>

            {/* Loading Indicator */}
            {isLoading && (
              <div className='text-center mt-4'>
                <div className='animate-pulse text-gray-300'>Processing...</div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className='mt-4 p-4 bg-red-50 rounded-lg text-red-600'>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Extracted Text Display */}
        <div
          className={`p-6 rounded-lg shadow-lg overflow-auto max-h-[600px] ${
            darkMode ? 'bg-gray-800' : 'bg-white'
          }`}
        >
          <h2 className='text-2xl font-bold mb-4 flex items-center gap-2'>
            <FileText className='h-5 w-5' />
            Result
          </h2>
          <div className='border border-gray-400 rounded-md p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono text-sm'>
            {extractedText
              ? extractedText
              : 'Upload a file to see the result here...'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
