import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper function to generate unique share IDs (adjective-noun-number pattern)
const adjectives = [
  'swift', 'bright', 'clever', 'bold', 'calm', 'keen', 'quick', 'sharp', 'wise', 'brave',
  'gentle', 'noble', 'proud', 'silent', 'smooth', 'steady', 'strong', 'swift', 'tall', 'wild',
  'ancient', 'cosmic', 'digital', 'eternal', 'fierce', 'golden', 'hidden', 'magic', 'mystic', 'quantum',
  'radiant', 'stellar', 'timeless', 'vibrant', 'zenith'
];

const nouns = [
  'eagle', 'wolf', 'lion', 'tiger', 'bear', 'hawk', 'fox', 'raven', 'dragon', 'phoenix',
  'star', 'moon', 'sun', 'comet', 'nebula', 'galaxy', 'planet', 'asteroid', 'cosmos', 'orbit',
  'code', 'byte', 'pixel', 'node', 'link', 'cloud', 'stream', 'wave', 'pulse', 'signal',
  'agent', 'mind', 'soul', 'spirit', 'heart', 'flame', 'crystal', 'gem', 'pearl', 'diamond'
];

export function generateShareId(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 1000);
  return `${adjective}-${noun}-${number}`;
}

export function getShareUrl(shareId: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/agent/${shareId}`;
  }
  // Server-side fallback
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/agent/${shareId}`;
}

// Generate a deterministic hash from a string
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Generate a unique gradient from agent name/ID
export function generateAgentGradient(seed: string): string {
  const hash = hashString(seed);
  
  // Predefined beautiful gradient combinations
  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
    'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    'linear-gradient(135deg, #ff8a80 0%, #ea6100 100%)',
    'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
    'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
    'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)',
    'linear-gradient(135deg, #c471ed 0%, #f64f59 100%)',
    'linear-gradient(135deg, #12c2e9 0%, #c471ed 50%, #f64f59 100%)',
    'linear-gradient(135deg, #fad961 0%, #f76b1c 100%)',
    'linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)',
    'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)',
    'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
    'linear-gradient(135deg, #fdbb2d 0%, #22c1c3 100%)',
  ];
  
  return gradients[hash % gradients.length];
}

// Generate avatar initials or emoji from agent name
export function generateAgentAvatar(seed: string): { type: 'initials' | 'emoji'; content: string } {
  const hash = hashString(seed);
  const name = seed.trim();
  
  // Use emoji for some agents (30% chance)
  if (hash % 10 < 3) {
    const emojis = ['🤖', '🧠', '⚡', '🔍', '📊', '💡', '🚀', '🎯', '🌟', '✨', '🔮', '🎨', '📝', '🔬', '🌐'];
    return { type: 'emoji', content: emojis[hash % emojis.length] };
  }
  
  // Otherwise use initials
  const words = name.split(/\s+/);
  if (words.length >= 2) {
    return {
      type: 'initials',
      content: (words[0][0] + words[1][0]).toUpperCase(),
    };
  }
  return {
    type: 'initials',
    content: name.substring(0, 2).toUpperCase(),
  };
}

// Generate personality traits based on agent properties
export function generatePersonalityTraits(agent: { prompt: string; tools: string[]; title: string }) {
  const promptLower = agent.prompt.toLowerCase();
  const toolCount = agent.tools.length;
  
  // Determine speed
  const speedKeywords = ['fast', 'quick', 'instant', 'rapid', 'speed', 'immediate'];
  const thoughtfulKeywords = ['think', 'analyze', 'consider', 'reflect', 'deep', 'thorough'];
  
  let speed: 'lightning' | 'thoughtful' | 'balanced' = 'balanced';
  if (speedKeywords.some((kw) => promptLower.includes(kw))) {
    speed = 'lightning';
  } else if (thoughtfulKeywords.some((kw) => promptLower.includes(kw))) {
    speed = 'thoughtful';
  }
  
  // Determine style
  const creativeKeywords = ['creative', 'imagine', 'design', 'artistic', 'innovative', 'unique'];
  const analyticalKeywords = ['analyze', 'data', 'statistics', 'metrics', 'research', 'study'];
  
  let style: 'creative' | 'analytical' | 'balanced' = 'balanced';
  if (creativeKeywords.some((kw) => promptLower.includes(kw))) {
    style = 'creative';
  } else if (analyticalKeywords.some((kw) => promptLower.includes(kw))) {
    style = 'analytical';
  }
  
  // Determine specialty
  const specialties: string[] = [];
  if (promptLower.includes('research') || promptLower.includes('find') || promptLower.includes('search')) {
    specialties.push('Good for Research');
  }
  if (promptLower.includes('write') || promptLower.includes('draft') || promptLower.includes('content')) {
    specialties.push('Great for Writing');
  }
  if (promptLower.includes('code') || promptLower.includes('programming') || promptLower.includes('develop')) {
    specialties.push('Code Assistant');
  }
  if (toolCount >= 3) {
    specialties.push('Multi-Tool');
  }
  
  return { speed, style, specialties };
}
