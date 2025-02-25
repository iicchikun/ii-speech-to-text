import React, { ChangeEvent, useState } from 'react';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Upload } from 'lucide-react';
import { Button } from './ui/button';

interface FileUploadProps {
  language: string;
  onTextUpdate: (text: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ language, onTextUpdate }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!language) {
      setError('Please select a language first');
      event.target.value = '';
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('language', language);

      setIsUploading(true);
      setUploadProgress(0);
      setError(null);

      // Simulate progress while processing
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/upload-file`,
        {
          method: 'POST',
          body: formData,
        }
      );

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      setUploadProgress(100);
      const data = await response.json();
      onTextUpdate(data.text);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  return (
    <div className='space-y-4'>
      <div className='relative border-2 border-dashed border-gray-500 p-6 rounded-lg text-center'>
        <input
          type='file'
          accept='audio/*,video/*'
          onChange={handleFileUpload}
          disabled={isUploading || !language}
          className='absolute inset-0 w-full h-full opacity-0 cursor-pointer'
        />
        <Upload className='h-8 w-8 mx-auto text-gray-300' />
        <p className='text-gray-300 mt-2'>Drag and drop or</p>
        <Button className='mt-2 flex items-center gap-2 mx-auto'>
          <Upload className='h-4 w-4' />
          Choose a file
        </Button>
        {isUploading && (
          <div>
            <div className='absolute inset-0 flex items-center justify-center bg-background/80'>
              <Progress value={uploadProgress} className='w-[60%]' />
            </div>
          </div>
        )}

        {error && (
          <Alert variant='destructive'>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
