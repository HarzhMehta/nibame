import { MemoryItem } from '@/types';

export const initialMockItems: MemoryItem[] = [
  {
    id: 'item-1',
    title: 'Distributed Systems & Event Streaming with Apache Kafka',
    content: 'Deep dive video lecture covering partition architecture, consumer groups, log compaction, and replication guarantees.',
    url: 'https://youtube.com/watch?v=sample-kafka-lecture',
    type: 'video',
    tags: ['Distributed Systems', 'Kafka', 'Backend'],
    status: 'inbox',
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(), // 35 minutes ago
    detectedEntities: ['Distributed Systems', 'Kafka', 'Backend Architecture'],
    metadata: {
      author: 'Martin Kleppmann',
      domain: 'youtube.com',
      readingTimeMinutes: 45,
    },
  },
  {
    id: 'item-2',
    title: 'apache/kafka - Mirror and Source Code',
    content: 'Official Apache Kafka open-source repository containing distributed event store and stream processing engine.',
    url: 'https://github.com/apache/kafka',
    type: 'github_repo',
    tags: ['Kafka', 'Open Source', 'Java'],
    status: 'inbox',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
    detectedEntities: ['Kafka', 'Open Source'],
    metadata: {
      domain: 'github.com',
      stars: 28400,
    },
  },
  {
    id: 'item-3',
    title: 'Ideas for GSoC 2026 Personal Context Engine',
    content: 'Need zero-latency capture modal, graph relationships (Person -> Company, Task -> Project), and natural language retrieval.',
    type: 'note',
    tags: ['Ideas', 'GSoC', 'Architecture'],
    status: 'inbox',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(), // 18 hours ago
    detectedEntities: ['GSoC 2026', 'Personal Context'],
  },
  {
    id: 'item-4',
    title: 'Designing Data-Intensive Applications: Reliable, Scalable Systems',
    content: 'Notes on consensus algorithms, Raft vs Paxos, transactions vs eventual consistency.',
    url: 'https://dataintensive.net',
    type: 'article',
    tags: ['Reading', 'Distributed Systems', 'Books'],
    status: 'inbox',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
    detectedEntities: ['Distributed Systems'],
    metadata: {
      author: 'Martin Kleppmann',
      domain: 'dataintensive.net',
      readingTimeMinutes: 12,
    },
  },
  {
    id: 'item-5',
    title: 'Mumbai Tech & Coffee Spots',
    content: 'Curated list of spots in Bandra and Lower Parel with good Wi-Fi and quiet atmosphere for deep work sessions.',
    type: 'note',
    tags: ['Places', 'Mumbai', 'Work'],
    status: 'inbox',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
    detectedEntities: ['Mumbai', 'Work'],
  },
  {
    id: 'item-6',
    title: 'Neo4j Graph Database Fundamentals',
    content: 'Landed in inbox via web capture. Explains nodes, labeled property graphs, and Cypher query pattern matching.',
    url: 'https://neo4j.com/developer/get-started/',
    type: 'url',
    tags: ['Graph Database', 'Neo4j', 'Database'],
    status: 'inbox',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(), // 7 days ago
    detectedEntities: ['Neo4j', 'Graph Database'],
    metadata: {
      domain: 'neo4j.com',
      readingTimeMinutes: 8,
    },
  },
];
