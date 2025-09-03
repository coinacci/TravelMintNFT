import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ObjectUploaderProps {
  onComplete?: (objectUrl: string) => void;
  buttonClassName?: string;
  children: ReactNode;
  accept?: string;
}

/**
 * A simple file upload component for Object Storage
 * 
 * @param props.onComplete - Callback function called when upload is complete
 * @param props.buttonClassName - Optional CSS class name for the button
 * @param props.children - Content to be rendered inside the button
 * @param props.accept - File types to accept (e.g., "image/*")
 */
export function ObjectUploader({
  onComplete,
  buttonClassName,
  children,
  accept = "image/*"
}: ObjectUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    try {
      // Upload file as buffer to object storage
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      formData.append('mimeType', file.type);

      const response = await fetch('/api/object-storage/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Object uploaded successfully:', result.objectUrl);
      
      if (onComplete) {
        onComplete(result.objectUrl);
      }
    } catch (error) {
      console.error('❌ Object upload failed:', error);
    } finally {
      setIsUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  return (
    <div>
      <input
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
        id="object-uploader-input"
        disabled={isUploading}
      />
      <label htmlFor="object-uploader-input">
        <Button 
          type="button" 
          className={buttonClassName}
          disabled={isUploading}
          asChild
        >
          <span style={{ cursor: isUploading ? 'not-allowed' : 'pointer' }}>
            {isUploading ? 'Uploading...' : children}
          </span>
        </Button>
      </label>
    </div>
  );
}