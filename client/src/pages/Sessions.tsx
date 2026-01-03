import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2, ArrowLeft, FileAudio, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";

export default function Sessions() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: sessions, isLoading } = trpc.audio.getSessions.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 5000, // Refetch every 5 seconds for status updates
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
      default:
        return <Badge variant="outline"><AlertCircle className="w-3 h-3 mr-1" />{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setLocation('/')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold text-gray-900">My Sessions</h1>
            <p className="text-gray-600 mt-2">View and manage your audio processing sessions</p>
          </div>
        </div>

        {!sessions || sessions.length === 0 ? (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="py-12 text-center">
              <FileAudio className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No sessions yet</h3>
              <p className="text-muted-foreground mb-6">
                Upload your first audio file to get started
              </p>
              <Button onClick={() => setLocation('/')}>
                Upload Audio File
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => (
              <Card
                key={session.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setLocation(`/sessions/${session.id}`)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg line-clamp-1">
                      {session.originalFilename}
                    </CardTitle>
                    {getStatusBadge(session.status)}
                  </div>
                  <CardDescription className="flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {session.durationSeconds && (
                      <p className="text-muted-foreground">
                        Duration: {Math.floor(session.durationSeconds / 60)} minutes
                      </p>
                    )}
                    {session.errorMessage && (
                      <p className="text-destructive text-xs">
                        Error: {session.errorMessage}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
