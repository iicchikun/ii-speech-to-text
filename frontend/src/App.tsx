import { useState } from 'react';
import { ThemeProvider, useTheme } from './components/theme-provider';
import { Moon, Sun, FileText, Mic } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import RealtimeSpeech from './components/RealtimeSpeech';
import FileUpload from './components/FileUpload';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from './components/ui/select';

function AppContent() {
  const { theme, setTheme } = useTheme();
  const [extractedText, setExtractedText] = useState<string>('');
  const [language, setLanguage] = useState<string>('');

  const handleTextUpdate = (text: string) => {
    setExtractedText((prev) => prev + ' ' + text);
  };

  return (
    <div
      className={`min-h-screen ${
        theme === 'dark'
          ? 'bg-gray-900 text-white'
          : 'bg-[#C9D9CD]/50 text-black'
      } font-sans flex items-center justify-center p-8 transition-all`}
    >
      <div className='absolute right-4 top-4'>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className='rounded-full p-2 hover:bg-accent'
        >
          {theme === 'dark' ? (
            <Sun className='h-5 w-5' />
          ) : (
            <Moon className='h-5 w-5' />
          )}
        </button>
      </div>

      <div className='w-full lg:max-w-6xl grid lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1 gap-8'>
        <div className='flex items-center justify-center'>
          <div
            className={`p-6 rounded-lg shadow-lg max-w-md w-full ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-[#294744]'
            }`}
          >
            <div className='flex flex-col items-center justify-center mb-6'>
              <h1 className='text-2xl font-bold text-white mb-2 gap-2 flex-wrap'>
                <span>Extract Speech, Read with Ease!</span>
              </h1>
              <p className='text-gray-300 mb-6 justify-center'>
                Can't catch every word? Let's get the text for you!
              </p>
            </div>

            <div className='flex flex-row gap-2flex items-center gap-4 mb-4'>
              <label
                htmlFor='language'
                className='text-gray-300 text-sm font-medium'
              >
                Language
              </label>
              <Select onValueChange={setLanguage}>
                <SelectTrigger className='max-w-screen bg-white dark:bg-gray-800 border border-gray-400 dark:border-gray-600 rounded-md px-3 py-2'>
                  <SelectValue placeholder='Select the language' />
                </SelectTrigger>
                <SelectContent className='z-50 bg-white dark:bg-gray-800 border border-gray-400 dark:border-gray-600 rounded-md shadow-lg'>
                  <SelectItem value='en-US'>English (US)</SelectItem>
                  <SelectItem value='en-GB'>English (UK)</SelectItem>
                  <SelectItem value='fr-FR'>French</SelectItem>
                  <SelectItem value='de-DE'>German</SelectItem>
                  <SelectItem value='it-IT'>Italian</SelectItem>
                  <SelectItem value='ja-JP'>Japanese</SelectItem>
                  <SelectItem value='ko-KR'>Korean</SelectItem>
                  <SelectItem value='es-ES'>Spanish</SelectItem>
                  <SelectItem value='id-ID'>Indonesian</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Tabs defaultValue='upload' className='space-y-4'>
              <TabsList className='grid w-full grid-cols-2'>
                <TabsTrigger value='upload' className='flex items-center gap-2'>
                  <FileText className='h-4 w-4' />
                  Upload File
                </TabsTrigger>
                <TabsTrigger
                  value='realtime'
                  className='flex items-center gap-2'
                >
                  <Mic className='h-4 w-4' />
                  Real-time Speech
                </TabsTrigger>
              </TabsList>

              <TabsContent value='upload'>
                <FileUpload
                  language={language}
                  onTextUpdate={handleTextUpdate}
                />
              </TabsContent>

              <TabsContent value='realtime'>
                <RealtimeSpeech
                  language={language}
                  onTextUpdate={handleTextUpdate}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Right Panel - Results */}
        <div
          className={`p-6 rounded-lg shadow-lg overflow-auto max-h-[600px] ${
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          }`}
        >
          <h2 className='text-2xl font-bold mb-4 flex items-center gap-2'>
            <FileText className='h-5 w-5' />
            Result
          </h2>
          <div className='border border-gray-400 rounded-md p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono text-sm'>
            {extractedText
              ? extractedText
              : 'Upload a file or start speaking to see the result here...'}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme='light' storageKey='app-theme'>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
