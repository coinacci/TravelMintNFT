import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bell, Users, Send, History, AlertCircle, CheckCircle2, XCircle, Settings } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface NotificationStatus {
  serviceAvailable: boolean;
  connectionTest: boolean;
  usersWithTokens: number;
  recentNotifications: number;
}

interface NotificationHistory {
  id: string;
  title: string;
  message: string;
  targetUrl?: string;
  recipientCount: number;
  successCount: number;
  failureCount: number;
  sentBy: string;
  sentAt: string;
}

interface NotificationUser {
  farcasterFid: string;
  farcasterUsername: string;
  hasToken: boolean;
  notificationsEnabled: boolean;
  lastNotificationSent?: string;
  totalPoints: number;
  weeklyPoints: number;
}

interface SecurityStatus {
  currentTime: string;
  rateLimiting: {
    maxAttempts: number;
    windowMinutes: number;
    blockDurationMinutes: number;
    totalRecentAttempts: number;
    blockedIPs: number;
    recentAttempts: Array<{
      ip: string;
      attempts: number;
      blocked: boolean;
    }>;
  };
  currentSession: {
    ip: string;
    userAgent: string;
    authenticated: boolean;
  };
}

export default function AdminNotifications() {
  const { toast } = useToast();
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('admin_key') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetUrl, setTargetUrl] = useState('');

  // Check authentication on mount
  useEffect(() => {
    if (adminKey) {
      setIsAuthenticated(true);
    }
  }, [adminKey]);

  // Save admin key to localStorage
  const handleAdminKeyChange = (key: string) => {
    setAdminKey(key);
    localStorage.setItem('admin_key', key);
    setIsAuthenticated(true);
  };

  // API Headers with admin key
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'x-admin-key': adminKey
  });

  // Fetch notification status
  const { data: status, isLoading: statusLoading, error: statusError } = useQuery({
    queryKey: ['admin', 'notifications', 'status'],
    queryFn: async () => {
      const response = await fetch('/api/admin/notifications/status', {
        headers: getHeaders()
      });
      if (!response.ok) {
        if (response.status === 401) {
          setIsAuthenticated(false);
          throw new Error('Authentication failed');
        }
        throw new Error('Failed to fetch status');
      }
      const data = await response.json();
      return data.status as NotificationStatus;
    },
    enabled: isAuthenticated && !!adminKey,
    retry: false
  });

  // Fetch notification history
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['admin', 'notifications', 'history'],
    queryFn: async () => {
      const response = await fetch('/api/admin/notifications/history?limit=10', {
        headers: getHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch history');
      const data = await response.json();
      return data.history as NotificationHistory[];
    },
    enabled: isAuthenticated && !!adminKey,
    retry: false
  });

  // Fetch users with notifications
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'notifications', 'users'],
    queryFn: async () => {
      const response = await fetch('/api/admin/notifications/users', {
        headers: getHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      return data.users as NotificationUser[];
    },
    enabled: isAuthenticated && !!adminKey,
    retry: false
  });

  // Fetch security status
  const { data: securityStatus, isLoading: securityLoading } = useQuery({
    queryKey: ['admin', 'security', 'status'],
    queryFn: async () => {
      const response = await fetch('/api/admin/security/status', {
        headers: getHeaders()
      });
      if (!response.ok) {
        if (response.status === 401) {
          setIsAuthenticated(false);
          throw new Error('Authentication failed');
        }
        if (response.status === 429) {
          throw new Error('Rate limited - too many attempts');
        }
        throw new Error('Failed to fetch security status');
      }
      const data = await response.json();
      return data.security as SecurityStatus;
    },
    enabled: isAuthenticated && !!adminKey,
    retry: false,
    refetchInterval: 30000 // Refresh security status every 30 seconds
  });

  // Send notification mutation
  const sendNotification = useMutation({
    mutationFn: async (payload: { title: string; message: string; targetUrl?: string }) => {
      const response = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send notification');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Notification Sent!",
        description: data.message,
      });
      setTitle('');
      setMessage('');
      setTargetUrl('');
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] });
    },
    onError: (error: any) => {
      toast({
        title: "Send Failed",
        description: error.message || "Failed to send notification",
        variant: "destructive",
      });
    }
  });

  // Handle form submission
  const handleSendNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast({
        title: "Validation Error",
        description: "Title and message are required",
        variant: "destructive",
      });
      return;
    }

    sendNotification.mutate({
      title: title.trim(),
      message: message.trim(),
      targetUrl: targetUrl.trim() || undefined
    });
  };

  // Authentication form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-6">
        <div className="max-w-md mx-auto mt-20">
          <Card data-testid="admin-auth-card">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Settings className="w-5 h-5" />
                Admin Access
              </CardTitle>
              <CardDescription>
                Enter admin key to access notification management
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="admin-key">Admin Key</Label>
                  <Input
                    id="admin-key"
                    type="password"
                    placeholder="Enter admin key..."
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    data-testid="input-admin-key"
                  />
                </div>
                <Button 
                  onClick={() => handleAdminKeyChange(adminKey)}
                  disabled={!adminKey.trim()}
                  className="w-full"
                  data-testid="button-admin-login"
                >
                  Access Admin Panel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-admin-title">Admin Notifications</h1>
              <p className="text-gray-600 dark:text-gray-400">Manage Farcaster notifications for TravelMint users</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => {
              localStorage.removeItem('admin_key');
              setAdminKey('');
              setIsAuthenticated(false);
            }}
            data-testid="button-logout"
          >
            Logout
          </Button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-service-status">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                {status?.serviceAvailable ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <div>
                  <p className="text-sm font-medium">Service Status</p>
                  <p className="text-xs text-gray-500">
                    {statusLoading ? 'Loading...' : status?.serviceAvailable ? 'Available' : 'Unavailable'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-connection-test">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                {status?.connectionTest ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                )}
                <div>
                  <p className="text-sm font-medium">API Connection</p>
                  <p className="text-xs text-gray-500">
                    {statusLoading ? 'Testing...' : status?.connectionTest ? 'Connected' : 'Failed'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-user-count">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">Users with Tokens</p>
                  <p className="text-lg font-bold" data-testid="text-user-count">
                    {statusLoading ? '...' : status?.usersWithTokens || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-recent-notifications">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-sm font-medium">Recent Notifications</p>
                  <p className="text-lg font-bold">
                    {statusLoading ? '...' : status?.recentNotifications || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Display */}
        {statusError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to connect: {statusError.message}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Send Notification Form */}
          <Card data-testid="card-send-notification">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Send Notification
              </CardTitle>
              <CardDescription>
                Compose and send notifications to all users with Farcaster tokens
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendNotification} className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Notification title..."
                    maxLength={100}
                    required
                    data-testid="input-notification-title"
                  />
                  <p className="text-xs text-gray-500 mt-1">{title.length}/100</p>
                </div>

                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Notification message..."
                    maxLength={500}
                    rows={4}
                    required
                    data-testid="input-notification-message"
                  />
                  <p className="text-xs text-gray-500 mt-1">{message.length}/500</p>
                </div>

                <div>
                  <Label htmlFor="targetUrl">Target URL (Optional)</Label>
                  <Input
                    id="targetUrl"
                    type="url"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="https://travelmint.replit.app"
                    data-testid="input-target-url"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={sendNotification.isPending || !title.trim() || !message.trim()}
                  className="w-full"
                  data-testid="button-send-notification"
                >
                  {sendNotification.isPending ? 'Sending...' : `Send to ${status?.usersWithTokens || 0} users`}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Notification History */}
          <Card data-testid="card-notification-history">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Recent Notifications
              </CardTitle>
              <CardDescription>
                History of sent notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {historyLoading ? (
                  <p className="text-gray-500">Loading history...</p>
                ) : history && history.length > 0 ? (
                  history.map((item) => (
                    <div key={item.id} className="border rounded-lg p-3 space-y-2" data-testid={`history-item-${item.id}`}>
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium text-sm">{item.title}</h4>
                        <Badge variant={item.failureCount > 0 ? "destructive" : "default"}>
                          {item.successCount}/{item.recipientCount}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{item.message}</p>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{new Date(item.sentAt).toLocaleString()}</span>
                        <span>by {item.sentBy}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">No notifications sent yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Security Status */}
        <Card data-testid="card-security-status">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Security Status
            </CardTitle>
            <CardDescription>
              Authentication security and rate limiting metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            {securityLoading ? (
              <p className="text-gray-500">Loading security status...</p>
            ) : securityStatus ? (
              <div className="space-y-4">
                {/* Current Session */}
                <div className="border rounded-lg p-3">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Current Session
                  </h4>
                  <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <p>IP: {securityStatus.currentSession.ip}</p>
                    <p>User Agent: {securityStatus.currentSession.userAgent}</p>
                    <p>Authenticated: {securityStatus.currentSession.authenticated ? 'Yes' : 'No'}</p>
                  </div>
                </div>

                {/* Rate Limiting Stats */}
                <div className="border rounded-lg p-3">
                  <h4 className="font-medium text-sm mb-2">Rate Limiting</h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-gray-500">Max Attempts</p>
                      <p className="font-medium">{securityStatus.rateLimiting.maxAttempts} per {securityStatus.rateLimiting.windowMinutes}min</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Block Duration</p>
                      <p className="font-medium">{securityStatus.rateLimiting.blockDurationMinutes} minutes</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Recent Attempts</p>
                      <p className="font-medium">{securityStatus.rateLimiting.totalRecentAttempts}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Blocked IPs</p>
                      <p className="font-medium text-red-600">{securityStatus.rateLimiting.blockedIPs}</p>
                    </div>
                  </div>
                </div>

                {/* Recent Attempts */}
                {securityStatus.rateLimiting.recentAttempts.length > 0 && (
                  <div className="border rounded-lg p-3">
                    <h4 className="font-medium text-sm mb-2">Recent Login Attempts</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {securityStatus.rateLimiting.recentAttempts.map((attempt, index) => (
                        <div key={index} className="flex justify-between items-center text-xs" data-testid={`security-attempt-${index}`}>
                          <span>{attempt.ip}</span>
                          <div className="flex items-center gap-2">
                            <span>{attempt.attempts} attempts</span>
                            <Badge variant={attempt.blocked ? "destructive" : "secondary"} className="text-xs">
                              {attempt.blocked ? 'Blocked' : 'Active'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Last Updated */}
                <p className="text-xs text-gray-500 text-center">
                  Last updated: {new Date(securityStatus.currentTime).toLocaleString()}
                </p>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Unable to load security status</p>
            )}
          </CardContent>
        </Card>

        {/* Users with Notifications */}
        <Card data-testid="card-notification-users">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Users with Notifications ({users?.length || 0})
            </CardTitle>
            <CardDescription>
              Users who have notification tokens enabled
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {usersLoading ? (
                <p className="text-gray-500">Loading users...</p>
              ) : users && users.length > 0 ? (
                users.map((user) => (
                  <div key={user.farcasterFid} className="flex justify-between items-center border rounded-lg p-3" data-testid={`user-item-${user.farcasterFid}`}>
                    <div>
                      <p className="font-medium text-sm">{user.farcasterUsername}</p>
                      <p className="text-xs text-gray-500">
                        {user.totalPoints} total points • {user.weeklyPoints} weekly
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={user.hasToken ? "default" : "secondary"}>
                        {user.hasToken ? 'Has Token' : 'No Token'}
                      </Badge>
                      {user.lastNotificationSent && (
                        <p className="text-xs text-gray-500 mt-1">
                          Last: {new Date(user.lastNotificationSent).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">No users with notification tokens yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}