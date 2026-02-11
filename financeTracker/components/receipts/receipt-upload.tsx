'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, Loader2, CheckCircle2, FileText, ImageIcon } from 'lucide-react';

interface ReceiptUploadProps {
  onUploadSuccess?: (receiptId: number) => void;
  onCancel?: () => void;
}

export function ReceiptUpload({ onUploadSuccess, onCancel }: ReceiptUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a JPEG, PNG, or PDF file.');
      return;
    }

    const fileIsPdf = file.type === 'application/pdf';
    const maxSize = fileIsPdf ? 20 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File too large. Max ${fileIsPdf ? '20MB' : '10MB'}.`);
      return;
    }

    setSelectedFile(file);
    setError(null);
    setIsPdf(fileIsPdf);

    if (!fileIsPdf) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('receipt', selectedFile);

      const response = await fetch('/api/receipts', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await response.json();
      setSuccess(true);
      setTimeout(() => onUploadSuccess?.(data.id), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreview(null);
    setIsPdf(false);
    setError(null);
    setSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Compact inline upload component
  return (
    <div className="border rounded-lg p-4 bg-card">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
        id="receipt-upload"
      />

      {error && (
        <div className="mb-3 p-2 rounded bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {success ? (
        <div className="flex items-center gap-2 text-emerald-500 py-2">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">Uploaded! Redirecting...</span>
        </div>
      ) : !selectedFile ? (
        // Drop zone - compact
        <div 
          className="flex items-center gap-4 cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Click to select a receipt</p>
            <p className="text-xs text-muted-foreground">PNG, JPG, or PDF</p>
          </div>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onCancel(); }}>
              Cancel
            </Button>
          )}
        </div>
      ) : (
        // Selected file - compact preview
        <div className="flex items-center gap-3">
          {/* Thumbnail */}
          <div className="h-16 w-16 rounded-lg bg-muted border overflow-hidden shrink-0 flex items-center justify-center">
            {isPdf ? (
              <FileText className="h-6 w-6 text-muted-foreground" />
            ) : preview ? (
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            )}
          </div>

          {/* File info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(selectedFile.size / 1024).toFixed(0)} KB
              {isPdf && ' • PDF'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              disabled={isUploading}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              size="sm"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Upload'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
