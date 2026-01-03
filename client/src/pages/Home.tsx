import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Upload, FileAudio, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.audio.uploadAudio.useMutation({
    onSuccess: (data) => {
      toast.success("Audio file uploaded successfully!");
      setLocation(`/sessions/${data.sessionId}`);
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
      setUploading(false);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/wav', 'audio/x-m4a'];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|m4a|wav|mp4)$/i)) {
        toast.error("Please select a valid audio file (MP3, M4A, WAV)");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        const base64Content = base64Data.split(',')[1]; // Remove data:audio/...;base64, prefix

        await uploadMutation.mutateAsync({
          filename: selectedFile.name,
          fileData: base64Content,
          mimeType: selectedFile.type || 'audio/mpeg',
        });
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error('Upload error:', error);
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/wav', 'audio/x-m4a'];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|m4a|wav|mp4)$/i)) {
        toast.error("Please select a valid audio file (MP3, M4A, WAV)");
        return;
      }
      setSelectedFile(file);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">Audio Splitter</CardTitle>
            <CardDescription className="text-base">
              Split audio files into 15-minute chunks with Tamil transcription
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                • Automatically split long audio files
              </p>
              <p className="text-sm text-muted-foreground">
                • Generate Tamil transcripts with speaker diarization
              </p>
              <p className="text-sm text-muted-foreground">
                • Download individual chunks and combined transcripts
              </p>
            </div>
            <Button
              className="w-full"
              onClick={() => window.location.href = getLoginUrl()}
            >
              Sign in to get started
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Audio Splitter</h1>
            <p className="text-gray-600 mt-2">Split and transcribe your audio files</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setLocation('/sessions')}
          >
            View Sessions
          </Button>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Upload Audio File</CardTitle>
            <CardDescription>
              Upload an audio file to split into 15-minute chunks and transcribe in Tamil
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-primary transition-colors cursor-pointer"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedFile ? (
                <div className="space-y-2">
                  <FileAudio className="w-16 h-16 mx-auto text-primary" />
                  <p className="text-lg font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-16 h-16 mx-auto text-gray-400" />
                  <p className="text-lg font-medium">
                    Drag and drop your audio file here
                  </p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports MP3, M4A, WAV formats
                  </p>
                </div>
              )}
              <Input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.m4a,.wav"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {selectedFile && (
              <Button
                className="w-full"
                size="lg"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload and Process
                  </>
                )}
              </Button>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-blue-900">What happens next?</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                <li>Your audio file will be uploaded securely</li>
                <li>It will be automatically split into 15-minute chunks</li>
                <li>You can then start Tamil transcription with speaker diarization</li>
                <li>Download individual chunks, transcripts, or combined transcript</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
