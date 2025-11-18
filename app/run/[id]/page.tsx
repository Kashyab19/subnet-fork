'use client';

import type React from 'react';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { AVAILABLE_TOOLS } from '@/lib/types';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { parse } from 'partial-json';
import {
  LoaderCircle,
  Play,
  Save,
  RotateCcw,
  Copy,
  Clock,
  Maximize2,
  Minimize2,
  X,
  History,
  GitCompare,
  Square,
  StopCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Agent } from '@/lib/types';

interface ExecutionHistory {
  id: string;
  query: string;
  result: any;
  executionTime: number;
  timestamp: Date;
}

interface AgentConfig {
  title: string;
  description: string;
  prompt: string;
  tools: string[];
}

export default function RunAgentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const agentId = params.id as string;

  // View state
  const [isSplitView, setIsSplitView] = useState(true);
  const [fullViewMode, setFullViewMode] = useState<'config' | 'test'>('config');

  // Agent state
  const [savedAgent, setSavedAgent] = useState<Agent | null>(null);
  const [savedConfig, setSavedConfig] = useState<AgentConfig | null>(null);
  const [currentConfig, setCurrentConfig] = useState<AgentConfig>({
    title: '',
    description: '',
    prompt: '',
    tools: [],
  });
  const [parentAgent, setParentAgent] = useState<AgentConfig | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  // Test execution state
  const [testQuery, setTestQuery] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentResult, setCurrentResult] = useState<any | null>(null);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistory[]>([]);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [wasStopped, setWasStopped] = useState(false);
  const reasoningRef = useRef<HTMLPreElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check if there are unsaved changes
  const hasUnsavedChanges = savedConfig
    ? JSON.stringify(savedConfig) !== JSON.stringify(currentConfig)
    : false;

  // Load agent
  useEffect(() => {
    if (agentId) {
      loadAgent(agentId);
    }
  }, [agentId]);

  const loadAgent = async (id: string) => {
    try {
      const response = await fetch(`/api/agents/${id}`);
      if (!response.ok) {
        router.push('/');
        return;
      }
      const agent = await response.json();
      setSavedAgent(agent);
      
      const config: AgentConfig = {
        title: agent.title,
        description: agent.description,
        prompt: agent.prompt,
        tools: agent.tools || [],
      };
      setSavedConfig(config);
      setCurrentConfig(config);

      // Load parent agent if this is a fork
      if (agent.parentAgent) {
        const parentConfig: AgentConfig = {
          title: agent.parentAgent.title,
          description: agent.parentAgent.description,
          prompt: agent.parentAgent.prompt,
          tools: agent.parentAgent.tools || [],
        };
        setParentAgent(parentConfig);
      }
    } catch (error) {
      console.error('Error loading agent:', error);
      toast({
        title: 'Error',
        description: 'Failed to load agent',
        variant: 'destructive',
      });
    }
  };

  // Scroll to bottom when result updates
  useEffect(() => {
    if (reasoningRef.current) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
    }
  }, [currentResult]);

  const handleToolToggle = (tool: string) => {
    setCurrentConfig((prev) => ({
      ...prev,
      tools: prev.tools.includes(tool) ? prev.tools.filter((t) => t !== tool) : [...prev.tools, tool],
    }));
    setSelectedHistoryIndex(null);
  };

  const handleTestRun = useCallback(async () => {
    if (isRunning || !currentConfig.prompt.trim()) {
      return;
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsRunning(true);
    setCurrentResult(null);
    setSelectedHistoryIndex(null);
    setExecutionTime(null);
    setWasStopped(false);
    const startTime = Date.now();

    try {
      const response = await fetch('/api/agents/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: currentConfig.prompt,
          tools: currentConfig.tools,
          query: testQuery,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to run test');
      }

      // Get the readable stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      // Read the stream
      const decoder = new TextDecoder();
      let accumulatedText = '';

      while (true) {
        // Check if aborted
        if (abortController.signal.aborted) {
          reader.cancel();
          break;
        }

        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode the chunk and accumulate it
        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;
        try {
          setCurrentResult(parse(accumulatedText));
        } catch (e) {
          // If parsing fails, just show the raw text
          setCurrentResult({ answer: accumulatedText });
        }
      }

      // Calculate execution time
      const endTime = Date.now();
      const time = endTime - startTime;
      setExecutionTime(time);

      // Parse the accumulated result
      let parsedResult;
      try {
        parsedResult = parse(accumulatedText);
      } catch (e) {
        parsedResult = { answer: accumulatedText };
      }

      // Only save to history if not aborted and we have some result
      if (!abortController.signal.aborted && accumulatedText.trim()) {
        // Add to history (keep last 5)
        const historyItem: ExecutionHistory = {
          id: Date.now().toString(),
          query: testQuery,
          result: parsedResult,
          executionTime: time,
          timestamp: new Date(),
        };

        setExecutionHistory((prev) => [historyItem, ...prev].slice(0, 5));
      } else if (abortController.signal.aborted && accumulatedText.trim()) {
        // If aborted but we have partial results, mark as stopped
        // The result is already set in the loop, just ensure execution time is set
        setWasStopped(true);
        // Don't add to history for stopped tests
      }
    } catch (error: any) {
      // Don't show error if it was aborted - partial results are already displayed
      if (error.name === 'AbortError' || abortController.signal.aborted) {
        // Partial results should already be displayed from the loop
        // Mark as stopped if we have any result, otherwise show message
        if (currentResult) {
          setWasStopped(true);
        } else {
          setCurrentResult({ answer: 'Test execution stopped.' });
          setWasStopped(true);
        }
      } else {
        console.error('Error running test:', error);
        setCurrentResult({ answer: 'Error: Failed to run test. Please try again.' });
        toast({
          title: 'Error',
          description: 'Failed to run test',
          variant: 'destructive',
        });
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  }, [isRunning, currentConfig.prompt, currentConfig.tools, testQuery, toast]);

  const handleStopTest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Keyboard shortcut for running test
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isRunning && currentConfig.prompt.trim()) {
        e.preventDefault();
        handleTestRun();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, currentConfig.prompt, handleTestRun]);

  const handleSave = async () => {
    if (!currentConfig.title.trim() || !currentConfig.description.trim() || !currentConfig.prompt.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      const agent = {
        title: currentConfig.title,
        description: currentConfig.description,
        prompt: currentConfig.prompt,
        tools: currentConfig.tools,
      };

      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agent),
      });

      if (!response.ok) {
        throw new Error('Failed to save agent');
      }

      const savedAgentData = await response.json();
      setSavedAgent(savedAgentData);
      setSavedConfig(currentConfig);
      toast({
        title: 'Success',
        description: 'Agent saved successfully',
      });
    } catch (error) {
      console.error('Error saving agent:', error);
      toast({
        title: 'Error',
        description: 'Failed to save agent',
        variant: 'destructive',
      });
    }
  };

  const handleReset = () => {
    if (savedConfig) {
      setCurrentConfig(savedConfig);
      setCurrentResult(null);
      setTestQuery('');
      setSelectedHistoryIndex(null);
      setExecutionHistory([]);
      toast({
        title: 'Reset',
        description: 'Configuration reset to saved state',
      });
    }
  };

  const handleHistorySelect = (index: number) => {
    const historyItem = executionHistory[index];
    setTestQuery(historyItem.query);
    setCurrentResult(historyItem.result);
    setExecutionTime(historyItem.executionTime);
    setSelectedHistoryIndex(index);
  };

  const handleClearHistory = () => {
    setExecutionHistory([]);
    setSelectedHistoryIndex(null);
    setCurrentResult(null);
    setTestQuery('');
    setExecutionTime(null);
  };

  const handleCopyOutput = () => {
    const displayResult = selectedHistoryIndex !== null ? executionHistory[selectedHistoryIndex]?.result : currentResult;
    if (displayResult?.answer) {
      navigator.clipboard.writeText(
        typeof displayResult.answer === 'string' ? displayResult.answer : JSON.stringify(displayResult.answer, null, 2),
      );
      toast({
        title: 'Copied',
        description: 'Output copied to clipboard',
      });
    }
  };

  const getToolLabel = (toolValue: string) => {
    const tool = AVAILABLE_TOOLS.find((t) => t.value === toolValue);
    return tool?.label || toolValue;
  };

  if (!savedAgent) {
    return (
      <div className="bg-background min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-16">
            <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    );
  }

  const displayResult = selectedHistoryIndex !== null ? executionHistory[selectedHistoryIndex]?.result : currentResult;
  const displayTime =
    selectedHistoryIndex !== null ? executionHistory[selectedHistoryIndex]?.executionTime : executionTime;

  const configPanel = (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b bg-muted/30 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-foreground text-xl font-bold">Agent Configuration</h2>
            <p className="text-muted-foreground text-sm">Edit and test your agent</p>
          </div>
          <div className="flex items-center gap-2">
            {parentAgent && (
              <Button
                onClick={() => setShowComparison(!showComparison)}
                variant={showComparison ? 'default' : 'outline'}
                size="sm"
              >
                <GitCompare className="mr-2 h-4 w-4" />
                {showComparison ? 'Hide' : 'Show'} Comparison
              </Button>
            )}
            <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
              Playground Mode
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
          <Button onClick={handleReset} disabled={!hasUnsavedChanges} size="sm" variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={currentConfig.title}
              onChange={(e) => setCurrentConfig({ ...currentConfig, title: e.target.value })}
              placeholder="e.g., Research Assistant"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={currentConfig.description}
              onChange={(e) => setCurrentConfig({ ...currentConfig, description: e.target.value })}
              placeholder="Brief description of what this agent does"
              rows={3}
            />
          </div>

          {showComparison && parentAgent ? (
            <div className="space-y-2">
              <Label>Agent Instructions Comparison</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground mb-2 text-xs">Before (Parent)</Label>
                  <div className="prose prose-sm text-foreground bg-muted/30 max-h-96 max-w-none overflow-y-auto rounded-md border p-3 text-xs">
                    <pre className="whitespace-pre-wrap font-mono">{parentAgent.prompt}</pre>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground mb-2 text-xs">After (Current)</Label>
                  <Textarea
                    value={currentConfig.prompt}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, prompt: e.target.value })}
                    placeholder="You are a search assistant that can use tools to find information. I want you to..."
                    rows={12}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="prompt">Agent Instructions</Label>
              <Textarea
                id="prompt"
                value={currentConfig.prompt}
                onChange={(e) => setCurrentConfig({ ...currentConfig, prompt: e.target.value })}
                placeholder="You are a search assistant that can use tools to find information. I want you to..."
                rows={12}
                className="font-mono text-sm"
              />
            </div>
          )}

          <div className="space-y-3">
            <Label>Available Tools</Label>
            <div className="space-y-3">
              {AVAILABLE_TOOLS.map((tool) => (
                <div key={tool.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={tool.value}
                    checked={currentConfig.tools.includes(tool.value)}
                    onCheckedChange={() => handleToolToggle(tool.value)}
                  />
                  <label
                    htmlFor={tool.value}
                    className="cursor-pointer text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {tool.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const testPanel = (
    <div className="flex h-full flex-col bg-muted/30">
      <div className="border-b bg-background p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-foreground text-xl font-bold">Test Execution</h2>
            <p className="text-muted-foreground text-sm">Run tests without saving</p>
          </div>
          {executionHistory.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <History className="mr-1 h-3 w-3" />
                {executionHistory.length} test{executionHistory.length !== 1 ? 's' : ''}
              </Badge>
              <Button onClick={handleClearHistory} size="sm" variant="ghost">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="test-query">Run Query</Label>
            <div className="flex gap-2">
              <Textarea
                id="test-query"
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                placeholder="Enter a test query..."
                rows={2}
                className="flex-1"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isRunning) {
                    e.preventDefault();
                    handleTestRun();
                  }
                }}
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleTestRun}
                  disabled={isRunning || !currentConfig.prompt.trim()}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {isRunning ? (
                    <>
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                       Run
                    </>
                  )}
                </Button>
                {isRunning && (
                  <Button
                    onClick={handleStopTest}
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300 transition-all duration-200 hover:scale-105"
                  >
                    <StopCircle className="mr-2 h-4 w-4" />
                    Stop
                  </Button>
                )}
              </div>
            </div>
            <p className="text-muted-foreground text-xs">Press Cmd/Ctrl + Enter to run</p>
          </div>

          {executionHistory.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Execution History</Label>
              <div className="flex flex-wrap gap-2">
                {executionHistory.map((item, index) => (
                  <Button
                    key={item.id}
                    onClick={() => handleHistorySelect(index)}
                    size="sm"
                    variant={selectedHistoryIndex === index ? 'default' : 'outline'}
                    className="text-xs"
                  >
                    Test {executionHistory.length - index}
                    {displayTime && index === selectedHistoryIndex && (
                      <Clock className="ml-1 h-3 w-3" />
                    )}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {displayResult ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              {displayTime && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Execution time: {displayTime}ms</span>
                </div>
              )}
              {wasStopped && selectedHistoryIndex === null && (
                <Badge variant="outline" className="border-orange-300 text-orange-600 dark:border-orange-800 dark:text-orange-400">
                  Stopped
                </Badge>
              )}
            </div>

            {displayResult?.reasoning && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3
                    className={cn(
                      'text-sm font-semibold',
                      isRunning && 'animate-pulse text-gray-400',
                    )}
                  >
                    Reasoning & Tool Usage
                  </h3>
                  {isRunning && <LoaderCircle className="h-4 w-4 animate-spin text-gray-400" />}
                </div>
                <div className="prose prose-sm text-foreground bg-muted/50 max-w-none rounded-md border p-3">
                  <pre
                    ref={reasoningRef}
                    className="bg-background max-h-[200px] overflow-y-auto rounded p-2 text-xs"
                  >
                    <code>{JSON.stringify(displayResult.reasoning, null, 2)}</code>
                  </pre>
                </div>
              </div>
            )}

            {displayResult?.answer && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Final Result</h3>
                  <Button onClick={handleCopyOutput} size="sm" variant="ghost">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="prose prose-sm text-foreground bg-muted/50 max-w-none rounded-md border p-3">
                  <ReactMarkdown>{displayResult.answer}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground mb-2 text-sm">No test results yet</p>
              <p className="text-muted-foreground text-xs">Enter a query and click "Test Run" to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-background flex h-screen flex-col">
      <Header />
      <div className="flex-1 overflow-hidden">
        <div className="border-b bg-background px-4 py-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-foreground text-2xl font-bold">Agent Playground</h1>
              <p className="text-muted-foreground text-sm">Test and iterate on agents without saving</p>
            </div>
            <div className="flex gap-2">
              {!isSplitView && (
                <div className="flex gap-1 rounded-md border p-1">
                  <Button
                    onClick={() => setFullViewMode('config')}
                    variant={fullViewMode === 'config' ? 'default' : 'ghost'}
                    size="sm"
                  >
                    Config
                  </Button>
                  <Button
                    onClick={() => setFullViewMode('test')}
                    variant={fullViewMode === 'test' ? 'default' : 'ghost'}
                    size="sm"
                  >
                    Test
                  </Button>
                </div>
              )}
              <Button
                onClick={() => setIsSplitView(!isSplitView)}
                variant="outline"
                size="sm"
              >
                {isSplitView ? (
                  <>
                    <Minimize2 className="mr-2 h-4 w-4" />
                    Full View
                  </>
                ) : (
                  <>
                    <Maximize2 className="mr-2 h-4 w-4" />
                    Split View
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {isSplitView ? (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={50} minSize={30}>
              {configPanel}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={50} minSize={30}>
              {testPanel}
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="h-full">
            {fullViewMode === 'config' ? (
              <div className="relative h-full">
                {configPanel}
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <Button
                    onClick={() => setFullViewMode('test')}
                    variant="outline"
                    size="sm"
                  >
                    Switch to Test View
                  </Button>
                </div>
              </div>
            ) : (
              <div className="relative h-full">
                {testPanel}
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <Button
                    onClick={() => setFullViewMode('config')}
                    variant="outline"
                    size="sm"
                  >
                    Switch to Config View
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
