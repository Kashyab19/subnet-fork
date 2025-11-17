export interface Agent {
  id: string;
  title: string;
  description: string;
  prompt: string;
  tools: string[];
  shareId?: string | null;
  isPublic?: boolean;
  parentAgentId?: string | null;
  parentAgent?: Agent | null; // For forked agent attribution
}

export const AVAILABLE_TOOLS = [
  { value: 'parallel_search', label: 'Parallel Search' },
  { value: 'exa_search', label: 'Exa Search' },
  { value: 'exa_crawl', label: 'Exa Crawl' },
  { value: 'exa_find_similar', label: 'Exa Find Similar' },
  { value: 'web_search', label: 'Google Web Search' },
  { value: 'webpage_understanding', label: 'Jina Webpage Understanding' },
] as const;
