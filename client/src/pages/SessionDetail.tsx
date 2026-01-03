import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Loader2, ArrowLeft, Download, FileAudio, FileText, Play, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function SessionDetail() {
  const { id } = useParams();
  const sessionId = parseInt(id || '0');
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [apiKey, setApiKey] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, refetch } = trpc.audio.getSessionDetails.useQuery(
    { sessionId },
    {
      enabled: !!user && !!sessionId,
      refetchInterval: 5000, // Refetch every 5 seconds for status updates
    }
  );

  const startTranscriptionMutation = trpc.audio.startTranscription.useMutation({
    onSuccess: () => {
      toast.success("Transcription started!");
      setDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to start transcription: ${error.message}`);
    },
  });

  const handleStartTranscription = () => {
    if (!apiKey.trim()) {
      toast.error("Please enter your SarvamAI API key");
      return;
    }

    startTranscriptionMutation.mutate({
      sessionId,
      apiKey: apiKey.trim(),
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Session not found</h3>
            <Button onClick={() => setLocation('/sessions')}>
              Back to Sessions
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { session, chunks, transcripts } = data;
  const chunkTranscripts = transcripts.filter(t => t.transcriptType === 'chunk');
  const combinedTranscript = transcripts.find(t => t.transcriptType === 'combined');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'uploading':
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Uploading</Badge>;
      case 'splitting':
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Splitting</Badge>;
      case 'transcribing':
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Transcribing</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const canStartTranscription = session.status === 'splitting' || (chunks.length > 0 && session.status !== 'transcribing' && session.status !== 'completed');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setLocation('/sessions')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{session.originalFilename}</h1>
            <p className="text-gray-600 mt-1">
              Created {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
            </p>
          </div>
          {getStatusBadge(session.status)}
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Duration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {session.durationSeconds ? `${Math.floor(session.durationSeconds / 60)} min` : 'Calculating...'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Audio Chunks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{chunks.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Transcripts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {chunkTranscripts.filter(t => t.status === 'completed').length} / {chunkTranscripts.length}
              </p>
            </CardContent>
          </Card>
        </div>

        {canStartTranscription && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1">Ready for Transcription</h3>
                  <p className="text-sm text-blue-700">
                    Start Tamil transcription with speaker diarization
                  </p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>Start Transcription</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Start Transcription</DialogTitle>
                      <DialogDescription>
                        Enter your SarvamAI API key to start transcribing the audio chunks
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="apiKey">SarvamAI API Key</Label>
                        <Input
                          id="apiKey"
                          type="password"
                          placeholder="sk_..."
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Get your API key from{" "}
                          <a
                            href="https://dashboard.sarvam.ai"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            dashboard.sarvam.ai
                          </a>
                        </p>
                      </div>
                      <Button
                        className="w-full"
                        onClick={handleStartTranscription}
                        disabled={startTranscriptionMutation.isPending}
                      >
                        {startTranscriptionMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Starting...
                          </>
                        ) : (
                          'Start Transcription'
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        )}

        {combinedTranscript && combinedTranscript.status === 'completed' && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-green-900">Combined Transcript Available</h3>
                    <p className="text-sm text-green-700">
                      All chunk transcripts merged in chronological order
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => window.open(combinedTranscript.fileUrl || '', '_blank')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Audio Chunks</CardTitle>
            <CardDescription>
              15-minute segments of your audio file
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chunks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                <p>Processing audio file...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {chunks.map((chunk, index) => {
                  const transcript = chunkTranscripts.find(t => t.chunkId === chunk.id);
                  
                  return (
                    <div
                      key={chunk.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <FileAudio className="w-5 h-5 text-gray-600" />
                        <div className="flex-1">
                          <p className="font-medium">{chunk.filename}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatTime(chunk.startTimeSeconds)} - {formatTime(chunk.endTimeSeconds)}
                            {' • '}
                            {Math.floor(chunk.durationSeconds / 60)} min
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {transcript && getStatusBadge(transcript.status)}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(chunk.fileUrl, '_blank')}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        {transcript && transcript.status === 'completed' && transcript.fileUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(transcript.fileUrl || '', '_blank')}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
