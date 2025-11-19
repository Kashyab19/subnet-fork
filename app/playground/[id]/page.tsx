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
import { ToolIcon } from '@/components/tool-icon';
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
  Sparkles,
  Brain,
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

export default function PlaygroundPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;
  const { toast } = useToast();

  const [savedAgent, setSavedAgent] = useState<Agent | null>(null);
  const [currentConfig, setCurrentConfig] = useState<AgentConfig>({
    title: '',
    description: '',
    prompt: '',
    tools: [],
  });
  const [savedConfig, setSavedConfig] = useState<AgentConfig | null>(null);
  const [parentAgent, setParentAgent] = useState<AgentConfig | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [testQuery, setTestQuery] = useState('');
  const [currentResult, setCurrentResult] = useState<any>(null);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistory[]>([]);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [wasStopped, setWasStopped] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [isSplitView, setIsSplitView] = useState(true);
  const [fullViewMode, setFullViewMode] = useState<'config' | 'test'>('config');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      if (window.innerWidth < 1024) {
        setIsSplitView(false);
      }
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const reasoningRef = useRef<HTMLPreElement>(null);
  const stopControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (agentId) {
      loadAgent(agentId);
    }
  }, [agentId]);

  useEffect(() => {
    if (savedConfig && currentConfig) {
      const hasChanges =
        currentConfig.title !== savedConfig.title ||
        currentConfig.description !== savedConfig.description ||
        currentConfig.prompt !== savedConfig.prompt ||
        JSON.stringify(currentConfig.tools.sort()) !== JSON.stringify(savedConfig.tools.sort());

      setHasUnsavedChanges(hasChanges);
    } else {
      setHasUnsavedChanges(false);
    }
  }, [currentConfig, savedConfig]);

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
    if (!testQuery.trim() || !currentConfig.prompt.trim()) {
      return;
    }

    setIsRunning(true);
    setWasStopped(false);
    setCurrentResult({ answer: '', reasoning: null });
    setSelectedHistoryIndex(null);
    setExecutionTime(null);

    const startTime = Date.now();
    stopControllerRef.current = new AbortController();

    let accumulatedAnswer = '';
    let accumulatedReasoning: any = null;

    try {
      const response = await fetch(`/api/agents/${agentId}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: testQuery,
          config: currentConfig,
        }),
        signal: stopControllerRef.current.signal,
      });

      if (!response.ok) {
        if (response.status === 499) {
          setWasStopped(true);
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run agent');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode the chunk
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            if (data.type === 'content') {
              accumulatedAnswer += data.content;
              setCurrentResult(prev => ({
                answer: accumulatedAnswer,
                reasoning: prev?.reasoning || accumulatedReasoning,
              }));
            } else if (data.type === 'reasoning') {
              if (Array.isArray(data.reasoning)) {
                accumulatedReasoning = data.reasoning;
              } else {
                if (!accumulatedReasoning) {
                  accumulatedReasoning = [];
                }
                const index = data.reasoning?.index || 0;
                accumulatedReasoning[index] = data.reasoning;
              }
              setCurrentResult(prev => ({
                answer: prev?.answer || accumulatedAnswer,
                reasoning: accumulatedReasoning,
              }));
            } else if (data.type === 'done') {
              const endTime = Date.now();
              const elapsed = endTime - startTime;
              
              const finalResult = {
                answer: data.answer || accumulatedAnswer,
                reasoning: data.reasoning || accumulatedReasoning,
              };
              
              setCurrentResult(finalResult);
              setExecutionTime(elapsed);

              const historyItem: ExecutionHistory = {
                id: Date.now().toString(),
                query: testQuery,
                result: finalResult,
                executionTime: elapsed,
                timestamp: new Date(),
              };
              setExecutionHistory((prev) => [historyItem, ...prev]);
            } else if (data.type === 'partial') {
              const endTime = Date.now();
              const elapsed = endTime - startTime;
              
              const partialResult = {
                answer: data.answer || accumulatedAnswer,
                reasoning: data.reasoning || accumulatedReasoning,
              };
              
              setCurrentResult(partialResult);
              setExecutionTime(elapsed);
              setWasStopped(true);

              const historyItem: ExecutionHistory = {
                id: Date.now().toString(),
                query: testQuery,
                result: partialResult,
                executionTime: elapsed,
                timestamp: new Date(),
              };
              setExecutionHistory((prev) => [historyItem, ...prev]);
            } else if (data.type === 'error') {
              throw new Error(data.error || 'Streaming error');
            }
          } catch (parseError) {
            continue;
          }
        }
      }

      if (accumulatedAnswer || accumulatedReasoning) {
        const finalResult = {
          answer: accumulatedAnswer,
          reasoning: accumulatedReasoning,
        };
        
        const endTime = Date.now();
        const elapsed = endTime - startTime;
        
        setCurrentResult(finalResult);
        setExecutionTime(elapsed);

        const historyItem: ExecutionHistory = {
          id: Date.now().toString(),
          query: testQuery,
          result: finalResult,
          executionTime: elapsed,
          timestamp: new Date(),
        };
        setExecutionHistory((prev) => [historyItem, ...prev]);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        if (accumulatedAnswer || accumulatedReasoning) {
          const endTime = Date.now();
          const elapsed = endTime - startTime;
          const partialResult = {
            answer: accumulatedAnswer,
            reasoning: accumulatedReasoning,
          };
          
          setCurrentResult(partialResult);
          setExecutionTime(elapsed);
          setWasStopped(true);

          const historyItem: ExecutionHistory = {
            id: Date.now().toString(),
            query: testQuery,
            result: partialResult,
            executionTime: elapsed,
            timestamp: new Date(),
          };
          setExecutionHistory((prev) => [historyItem, ...prev]);
        } else {
          const endTime = Date.now();
          const elapsed = endTime - startTime;
          setExecutionTime(elapsed);
          setWasStopped(true);
        }
        return;
      }
      console.error('Error running agent:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to run agent',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
      stopControllerRef.current = null;
    }
  }, [testQuery, currentConfig, agentId, toast]);

  const handleStopTest = () => {
    if (stopControllerRef.current) {
      stopControllerRef.current.abort();
    }
  };

  const handleHistorySelect = (index: number) => {
    setSelectedHistoryIndex(index);
  };

  const handleClearHistory = () => {
    setExecutionHistory([]);
    setSelectedHistoryIndex(null);
    setCurrentResult(null);
    setExecutionTime(null);
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(currentConfig),
      });

      if (!response.ok) {
        throw new Error('Failed to save agent');
      }

      const updatedAgent = await response.json();
      setSavedAgent(updatedAgent);
      setSavedConfig({ ...currentConfig });
      setHasUnsavedChanges(false);

      toast({
        title: 'Saved',
        description: 'Agent updated successfully',
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
      setCurrentConfig({ ...savedConfig });
      setSelectedHistoryIndex(null);
    }
  };

  const handleOptimize = async () => {
    if (!currentConfig.prompt.trim()) {
      return;
    }

    setIsOptimizing(true);
    try {
      const response = await fetch('/api/agents/optimize-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: currentConfig.prompt }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to optimize prompt';
        console.error('API Error:', errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        return;
      }

      const data = await response.json();

      if (!data.optimizedPrompt) {
        throw new Error('No optimized prompt returned from API');
      }

      setCurrentConfig({ ...currentConfig, prompt: data.optimizedPrompt });
      toast({
        title: 'Prompt Optimized',
        description: 'Your prompt has been enhanced with best practices',
      });
    } catch (error) {
      console.error('Error optimizing prompt:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to optimize prompt. Please try again.';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsOptimizing(false);
    }
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
    <div className="flex h-full flex-col bg-background overflow-hidden">
      <div className="border-b bg-gradient-to-r from-muted/50 to-muted/30 p-3 sm:p-4 md:p-5 shadow-sm shrink-0">
        <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {parentAgent && (
              <Button
                onClick={() => setShowComparison(!showComparison)}
                variant={showComparison ? 'default' : 'outline'}
                size="sm"
                className="transition-all hover:scale-105 text-xs sm:text-sm"
              >
                <GitCompare className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{showComparison ? 'Hide' : 'Show'} Comparison</span>
                <span className="sm:hidden">Compare</span>
              </Button>
            )}
            <Badge variant="secondary" className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-300/30 shadow-sm text-xs">
              <Play className="mr-1 h-2.5 w-2.5 sm:mr-1.5 sm:h-3 sm:w-3" />
              <span className="hidden sm:inline">Playground Mode</span>
              <span className="sm:hidden">Playground</span>
            </Badge>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            size="sm"
            className={cn(
              "bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-sm text-xs sm:text-sm",
              hasUnsavedChanges && "hover:shadow-md hover:scale-105"
            )}
          >
            <Save className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Save Changes</span>
            <span className="sm:hidden">Save</span>
            {hasUnsavedChanges && <span className="ml-1 h-1 w-1 sm:ml-1.5 sm:h-1.5 sm:w-1.5 rounded-full bg-white/80 animate-pulse" />}
          </Button>
          <Button 
            onClick={handleReset} 
            disabled={!hasUnsavedChanges} 
            size="sm" 
            variant="outline"
            className="transition-all hover:scale-105 text-xs sm:text-sm"
          >
            <RotateCcw className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Reset
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 md:p-6 bg-gradient-to-b from-background to-muted/20 min-h-0">
        <div className="space-y-4 sm:space-y-6 max-w-2xl mx-auto pb-4">
          <Card className="border-2 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-xs sm:text-sm font-semibold">Title</Label>
                <Input
                  id="title"
                  value={currentConfig.title}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, title: e.target.value })}
                  placeholder="e.g., Research Assistant"
                  className="transition-all focus:ring-2 focus:ring-primary/20 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-xs sm:text-sm font-semibold">Description</Label>
                <Textarea
                  id="description"
                  value={currentConfig.description}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, description: e.target.value })}
                  placeholder="Brief description of what this agent does"
                  rows={3}
                  className="transition-all focus:ring-2 focus:ring-primary/20 resize-none text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {showComparison && parentAgent ? (
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <Label>Agent Instructions Comparison</Label>
                <Button
                  onClick={handleOptimize}
                  disabled={isOptimizing || !currentConfig.prompt.trim()}
                  size="sm"
                  variant="outline"
                  className="gap-2 transition-all hover:scale-105 hover:bg-primary/5 hover:border-primary/30"
                >
                  {isOptimizing ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Optimizing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-primary" />
                      Magic Optimize
                    </>
                  )}
                </Button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
            <Card className="border-2 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:p-4 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <Label htmlFor="prompt" className="text-xs sm:text-sm font-semibold">Agent Instructions</Label>
                  <Button
                    onClick={handleOptimize}
                    disabled={isOptimizing || !currentConfig.prompt.trim()}
                    size="sm"
                    variant="outline"
                    className="gap-1.5 sm:gap-2 transition-all hover:scale-105 hover:bg-primary/5 hover:border-primary/30 text-xs sm:text-sm w-full sm:w-auto"
                  >
                    {isOptimizing ? (
                      <>
                        <LoaderCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                        <span className="hidden sm:inline">Optimizing...</span>
                        <span className="sm:hidden">Optimizing</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                        <span className="hidden sm:inline">Magic Optimize</span>
                        <span className="sm:hidden">Optimize</span>
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  id="prompt"
                  value={currentConfig.prompt}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, prompt: e.target.value })}
                  placeholder="You are a search assistant that can use tools to find information. I want you to..."
                  rows={10}
                  className="font-mono text-xs sm:text-sm transition-all focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </CardContent>
            </Card>
          )}

          <Card className="border-2 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              <Label className="text-xs sm:text-sm font-semibold">Available Tools</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                {AVAILABLE_TOOLS.map((tool) => (
                  <div 
                    key={tool.value} 
                    className={cn(
                      "flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-lg border-2 transition-all cursor-pointer hover:bg-muted/50",
                      currentConfig.tools.includes(tool.value) 
                        ? "border-primary/50 bg-primary/5 shadow-sm" 
                        : "border-transparent hover:border-muted-foreground/20"
                    )}
                    onClick={() => handleToolToggle(tool.value)}
                  >
                    <Checkbox
                      id={tool.value}
                      checked={currentConfig.tools.includes(tool.value)}
                      onCheckedChange={() => handleToolToggle(tool.value)}
                      className="cursor-pointer shrink-0"
                    />
                    <label
                      htmlFor={tool.value}
                      className="cursor-pointer text-xs sm:text-sm font-medium flex-1 flex items-center gap-1.5 sm:gap-2 min-w-0"
                    >
                      <ToolIcon tool={tool.value} size={14} className="shrink-0" />
                      <span className="truncate">{tool.label}</span>
                    </label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  const testPanel = (
    <div className="flex h-full flex-col bg-gradient-to-br from-muted/30 via-background to-muted/20">
      <div className="border-b bg-gradient-to-r from-background to-muted/30 p-4 md:p-5 shadow-sm">
        <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-foreground text-lg md:text-xl font-bold flex items-center gap-2">
              <Play className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              Test Execution
            </h2>
            <p className="text-muted-foreground text-xs md:text-sm mt-1">Run tests without saving</p>
          </div>
          {executionHistory.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-primary/10 border-primary/20">
                <History className="mr-1 h-3 w-3" />
                {executionHistory.length} test{executionHistory.length !== 1 ? 's' : ''}
              </Badge>
              <Button onClick={handleClearHistory} size="sm" variant="ghost" className="h-7 w-7 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card className="border-2 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <Label htmlFor="test-query" className="text-sm font-semibold">Run Query</Label>
              <div className="flex flex-col gap-2">
                <Textarea
                  id="test-query"
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  placeholder="Enter a test query..."
                  rows={3}
                  className="flex-1 transition-all focus:ring-2 focus:ring-primary/20 resize-none"
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
                    className={cn(
                      "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all duration-200 flex-1 h-10 group relative overflow-hidden px-6",
                      !isRunning && "hover:scale-[1.02] active:scale-[0.98]",
                      !currentConfig.prompt.trim() && "opacity-50 cursor-not-allowed",
                      isRunning && "cursor-wait"
                    )}
                  >
                    {isRunning ? (
                      <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        <span>Running...</span>
                        <span className="ml-2 h-2 w-2 rounded-full bg-primary-foreground/50 animate-pulse" />
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        <span className="font-medium">Run</span>
                        {!currentConfig.prompt.trim() && (
                          <span className="ml-2 text-xs opacity-75">(add prompt)</span>
                        )}
                      </>
                    )}
                  </Button>
                  {isRunning && (
                    <Button
                      onClick={handleStopTest}
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] h-10 font-medium px-6"
                    >
                      <StopCircle className="mr-2 h-4 w-4" />
                      Stop
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-muted-foreground text-xs flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted rounded border">⌘</kbd>
                <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted rounded border">Enter</kbd>
                to run
              </p>
            </CardContent>
          </Card>

          {executionHistory.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Execution History</Label>
              <div className="flex flex-wrap gap-2">
                {executionHistory.map((item, index) => (
                  <Button
                    key={item.id}
                    onClick={() => handleHistorySelect(index)}
                    size="sm"
                    variant={selectedHistoryIndex === index ? 'default' : 'outline'}
                    className={cn(
                      "text-xs transition-all",
                      selectedHistoryIndex === index && "shadow-md",
                      selectedHistoryIndex !== index && "hover:scale-105"
                    )}
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

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {displayResult ? (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              {displayTime && (
                <Badge variant="outline" className="bg-primary/10 border-primary/20">
                  <Clock className="mr-1.5 h-3.5 w-3.5" />
                  <span className="text-sm font-medium">Execution time: {displayTime}ms</span>
                </Badge>
              )}
              {wasStopped && selectedHistoryIndex === null && (
                <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-600 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-400">
                  <StopCircle className="mr-1.5 h-3.5 w-3.5" />
                  Stopped
                </Badge>
              )}
            </div>

            {displayResult?.reasoning && (
              <Card className="border-2 shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm md:text-base flex items-center gap-2">
                      <Brain className="h-4 w-4 text-primary" />
                      Reasoning & Tool Usage
                    </CardTitle>
                    {isRunning && <LoaderCircle className="h-4 w-4 animate-spin text-primary" />}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/30 rounded-lg border p-4">
                    <pre
                      ref={reasoningRef}
                      className="bg-background max-h-[300px] overflow-y-auto rounded p-3 text-xs font-mono"
                    >
                      <code>{JSON.stringify(displayResult.reasoning, null, 2)}</code>
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}

            {displayResult?.answer && (
              <Card className="border-2 shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm md:text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Final Result
                    </CardTitle>
                    <Button onClick={handleCopyOutput} size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-primary/10">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm text-foreground max-w-none rounded-lg border bg-muted/30 p-4">
                    <ReactMarkdown>{displayResult.answer}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-4 px-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                <Play className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-foreground mb-1 text-base font-medium">No test results yet</p>
                <p className="text-muted-foreground text-sm">Enter a query and click "Run" to get started</p>
              </div>
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
        <div className="border-b bg-gradient-to-r from-background via-muted/30 to-background px-4 md:px-6 py-3 md:py-4 shadow-sm">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-foreground text-lg sm:text-xl md:text-2xl font-bold flex items-center gap-2">
                  <Brain className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-primary shrink-0" />
                  <span className="truncate">Agent Playground</span>
                </h1>
                <p className="text-muted-foreground text-xs md:text-sm mt-1">Test and iterate on agents without saving</p>
              </div>
              <div className="hidden lg:flex gap-2 flex-wrap shrink-0">
                {!isSplitView && (
                  <div className="flex gap-1 rounded-md border p-1">
                    <Button
                      onClick={() => setFullViewMode('config')}
                      variant={fullViewMode === 'config' ? 'default' : 'ghost'}
                      size="sm"
                      className="text-sm"
                    >
                      Config
                    </Button>
                    <Button
                      onClick={() => setFullViewMode('test')}
                      variant={fullViewMode === 'test' ? 'default' : 'ghost'}
                      size="sm"
                      className="text-sm"
                    >
                      Test
                    </Button>
                  </div>
                )}
                <Button
                  onClick={() => setIsSplitView(!isSplitView)}
                  variant="outline"
                  size="sm"
                  className="text-sm"
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
        </div>

        {/* Desktop: Split view or single view */}
        <div className="hidden lg:block h-full">
          {isSplitView ? (
            <ResizablePanelGroup direction="horizontal" className="h-full">
              <ResizablePanel defaultSize={50} minSize={30} className="min-w-0">
                {configPanel}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={50} minSize={30} className="min-w-0">
                {testPanel}
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <div className="h-full">
              {fullViewMode === 'config' ? (
                <div className="relative h-full">
                  {configPanel}
                  <div className="absolute bottom-4 right-4 flex gap-2 z-10">
                    <Button
                      onClick={() => setFullViewMode('test')}
                      variant="outline"
                      size="sm"
                      className="text-sm shadow-lg"
                    >
                      Switch to Test View
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="relative h-full">
                  {testPanel}
                  <div className="absolute bottom-4 right-4 flex gap-2 z-10">
                    <Button
                      onClick={() => setFullViewMode('config')}
                      variant="outline"
                      size="sm"
                      className="text-sm shadow-lg"
                    >
                      Switch to Config View
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile/Tablet: Tab-based view switcher */}
        <div className="lg:hidden h-full flex flex-col">
          <div className="flex border-b bg-background shrink-0">
            <button
              onClick={() => setFullViewMode('config')}
              className={cn(
                "flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2",
                fullViewMode === 'config'
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Configuration
            </button>
            <button
              onClick={() => setFullViewMode('test')}
              className={cn(
                "flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2",
                fullViewMode === 'test'
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Test Execution
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {fullViewMode === 'config' ? configPanel : testPanel}
          </div>
        </div>
      </div>
    </div>
  );
}

