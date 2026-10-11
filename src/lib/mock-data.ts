import { CandidateSetup, Question, TargetRole, EvaluationReport } from "./types";

export const ROLE_LABELS: Record<TargetRole, string> = {
  frontend: "Frontend Developer",
  backend: "Backend Developer",
  fullstack: "Full Stack Developer",
  python: "Python Developer",
  java: "Java Developer",
  "data-analyst": "Data Analyst",
};

export const ROLE_SKILLS: Record<TargetRole, string[]> = {
  frontend: ["React 19", "Next.js", "TypeScript", "Tailwind CSS", "State Management", "Web Performance"],
  backend: ["Node.js", "PostgreSQL", "System Architecture", "REST & GraphQL", "Caching / Redis", "Authentication"],
  fullstack: ["Next.js", "TypeScript", "PostgreSQL", "Node.js", "API Design", "Distributed Systems"],
  python: ["Python 3.12", "FastAPI", "AsyncIO", "Data Structures", "Pandas", "PyTest"],
  java: ["Java 21", "Spring Boot", "JVM Internals", "Hibernate / JPA", "Microservices", "Concurrency"],
  "data-analyst": ["SQL Analytics", "Python (Pandas)", "Data Modeling", "Tableau / BI", "Statistical Testing", "ETL Pipelines"],
};

export const SAMPLE_CANDIDATE: CandidateSetup = {
  candidateName: "Alex Rivera",
  targetRole: "fullstack",
  experienceLevel: "intermediate",
  interviewFocus: "mixed",
  interviewLength: 20,
  resumeFileName: "Alex_Rivera_FullStack_Resume.pdf",
  resumeFileSize: "2.4 MB",
  isSampleResume: true,
  skills: ["React / Next.js", "TypeScript", "Node.js", "PostgreSQL", "System Design", "Docker"],
  createdAt: new Date().toISOString(),
};

export const QUESTION_BANK: Record<TargetRole, Question[]> = {
  fullstack: [
    {
      id: "fs-1",
      role: "fullstack",
      category: "System Architecture",
      difficulty: "intermediate",
      questionText:
        "In a modern Next.js and Node.js microservice architecture, how would you design a resilient caching layer to minimize database load while preventing cache stampedes and stale data?",
      hint: "Consider Redis caching strategies such as Cache-Aside, TTL jitter, mutual exclusion locks, or write-through invalidation.",
      expectedKeywords: ["redis", "ttl", "cache-aside", "invalidation", "stampede", "mutex", "stale-while-revalidate"],
      followUpBranches: [
        {
          keywordTrigger: ["redis", "mutex", "lock"],
          followUpQuestionId: "fs-2a",
          rationale: "Candidate identified distributed locks; probe deeper into race conditions.",
        },
      ],
    },
    {
      id: "fs-2a",
      role: "fullstack",
      category: "Concurrency & State",
      difficulty: "advanced",
      questionText:
        "Since you mentioned distributed locking, how do you handle lock expiry when a node process encounters prolonged garbage collection or a network partition before releasing the lock?",
      hint: "Look into fencing tokens, redlock algorithm nuances, or versioned optimistic concurrency checks.",
      expectedKeywords: ["fencing", "token", "partition", "redlock", "heartbeat", "lease", "optimistic"],
    },
    {
      id: "fs-2b",
      role: "fullstack",
      category: "Data Consistency",
      difficulty: "intermediate",
      questionText:
        "When dealing with multi-region database replication, how do you manage read-after-write consistency for a user who immediately reloads their profile after updating it?",
      hint: "Discuss read-your-writes consistency, routing writes to primary nodes, and sticky sessions.",
      expectedKeywords: ["read-after-write", "replication", "primary", "lag", "eventual", "session"],
    },
    {
      id: "fs-3",
      role: "fullstack",
      category: "Frontend Performance",
      difficulty: "intermediate",
      questionText:
        "How do React Server Components (RSC) and streaming SSR improve Core Web Vitals (LCP & INP) compared to traditional client-side SPA rendering?",
      hint: "Explain zero bundle size for server dependencies, initial HTML hydration boundaries, and selective hydration.",
      expectedKeywords: ["rsc", "hydration", "bundle", "lcp", "inp", "streaming", "suspense"],
    },
  ],
  frontend: [
    {
      id: "fe-1",
      role: "frontend",
      category: "Core React & State",
      difficulty: "intermediate",
      questionText:
        "Explain the differences between client-side state managers (e.g., Zustand) and server-cache solutions (e.g., TanStack Query or Next.js fetch cache). When is each preferred?",
      hint: "Distinguish transient UI state (drawers, modals) from server-synchronized data with staleness and invalidation.",
      expectedKeywords: ["server-cache", "invalidation", "stale", "optimistic", "zustand", "mutation"],
    },
    {
      id: "fe-2",
      role: "frontend",
      category: "Web Performance",
      difficulty: "advanced",
      questionText:
        "A large enterprise dashboard suffers from high Interaction to Next Paint (INP) during fast table filtering. Walk through your systematic debugging and optimization steps.",
      hint: "Think about useTransition, useDeferredValue, virtualization, requestIdleCallback, and profiler traces.",
      expectedKeywords: ["inp", "transition", "profiler", "virtualization", "deferred", "main-thread"],
    },
    {
      id: "fe-3",
      role: "frontend",
      category: "CSS Architecture",
      difficulty: "intermediate",
      questionText:
        "What are the structural trade-offs of modern Tailwind CSS utility-first styling versus CSS Modules or CSS-in-JS in a scalable design system?",
      hint: "Compare runtime performance, zero-runtime compilation, bundle sizes, and token reusability.",
      expectedKeywords: ["zero-runtime", "bundle", "purge", "specificity", "tokens", "consistency"],
    },
  ],
  backend: [
    {
      id: "be-1",
      role: "backend",
      category: "Database Indexing",
      difficulty: "intermediate",
      questionText:
        "Explain how B-Tree indexes work in PostgreSQL. Why might an index not be used by the query planner even when the queried column has a valid index?",
      hint: "Consider index selectivity, sequential scan cost thresholds, functions on columns, or missing composite column order.",
      expectedKeywords: ["b-tree", "selectivity", "planner", "cost", "sequential", "composite"],
    },
    {
      id: "be-2",
      role: "backend",
      category: "API & Reliability",
      difficulty: "intermediate",
      questionText:
        "How do you implement true idempotency for financial or payment processing APIs where network timeouts cause clients to retry requests?",
      hint: "Think about Idempotency-Key headers, atomic database transactions, unique constraints, and status states.",
      expectedKeywords: ["idempotency", "header", "transaction", "unique", "payload", "retry"],
    },
    {
      id: "be-3",
      role: "backend",
      category: "Message Queues",
      difficulty: "advanced",
      questionText:
        "In an event-driven system with RabbitMQ or Kafka, how do you handle dead-lettering, message ordering, and exactly-once processing guarantees?",
      hint: "Mention idempotent consumers, partitioning keys, dead-letter exchanges, and retry backoffs.",
      expectedKeywords: ["kafka", "dead-letter", "partition", "ordering", "consumer", "deduplication"],
    },
  ],
  python: [
    {
      id: "py-1",
      role: "python",
      category: "Python Internals",
      difficulty: "intermediate",
      questionText:
        "Explain the Python GIL (Global Interpreter Lock). In what scenarios does multi-threading provide concurrency benefits, and when should you use multiprocessing or asyncio instead?",
      hint: "Contrast I/O-bound tasks vs CPU-bound computational workloads and Python 3.13 free-threading developments.",
      expectedKeywords: ["gil", "i/o-bound", "cpu-bound", "asyncio", "multiprocessing", "threads"],
    },
    {
      id: "py-2",
      role: "python",
      category: "FastAPI & Async",
      difficulty: "intermediate",
      questionText:
        "In FastAPI, what happens under the hood when an endpoint is declared as `async def` versus standard `def`? How does FastAPI schedule synchronous endpoints?",
      hint: "FastAPI runs synchronous `def` endpoints on an external AnyIO threadpool to prevent blocking the event loop.",
      expectedKeywords: ["event-loop", "threadpool", "blocking", "asyncio", "coroutine", "anyio"],
    },
  ],
  java: [
    {
      id: "jv-1",
      role: "java",
      category: "JVM Internals & GC",
      difficulty: "intermediate",
      questionText:
        "Explain the memory regions of the JVM (Heap, Metaspace, Stack) and how the G1 Garbage Collector manages generational collections compared to ZGC.",
      hint: "Describe Eden, Survivor, Old Gen spaces, stop-the-world pauses, and low-latency concurrent compaction.",
      expectedKeywords: ["heap", "metaspace", "stack", "g1gc", "zgc", "eden", "stop-the-world"],
    },
    {
      id: "jv-2",
      role: "java",
      category: "Concurrency & Spring",
      difficulty: "advanced",
      questionText:
        "How do Java 21 Virtual Threads (Project Loom) differ from platform OS threads, and how does this impact Spring Boot connection pool sizing?",
      hint: "Discuss lightweight user-mode fibers, non-blocking carrier thread unmounting, and synchronized pinning gotchas.",
      expectedKeywords: ["virtual-threads", "loom", "carrier", "pinning", "throughput", "blocking"],
    },
  ],
  "data-analyst": [
    {
      id: "da-1",
      role: "data-analyst",
      category: "SQL Window Functions",
      difficulty: "intermediate",
      questionText:
        "Write the conceptual SQL and explain the difference between `RANK()`, `DENSE_RANK()`, and `ROW_NUMBER()` when evaluating sales representative performance across departments.",
      hint: "Focus on how ties in values are handled and whether sequence gaps are introduced.",
      expectedKeywords: ["rank", "dense_rank", "row_number", "partition by", "order by", "ties"],
    },
    {
      id: "da-2",
      role: "data-analyst",
      category: "Data Modeling & Metrics",
      difficulty: "intermediate",
      questionText:
        "A SaaS company notices a sudden 15% drop in day-7 cohort retention. How would you systematically decompose this metric to isolate the root cause?",
      hint: "Break down by acquisition channel, platform/device, feature release correlation, and user onboarding milestones.",
      expectedKeywords: ["cohort", "retention", "segmentation", "funnel", "attribution", "root-cause"],
    },
  ],
};

export const SAMPLE_REPORT: EvaluationReport = {
  sessionId: "demo-session-alex",
  candidateName: "Alex Rivera",
  targetRole: "Full Stack Developer",
  experienceLevel: "Intermediate",
  interviewFocus: "Mixed (Architecture & Performance)",
  completedAt: "Oct 11, 2026",
  durationMinutes: 18,
  overallScore: 88,
  verdict: "Strong Hire Recommendation",
  shortlistStatus: "shortlisted",
  shortlistNotes: "Outstanding distributed systems clarity. Strong command of Cache-Aside, Redis mutex, and RSC hydration.",
  userId: "usr_demo_alex",
  metrics: [
    { category: "System Architecture", score: 92, level: "Mastery", totalEvaluated: 1 },
    { category: "Concurrency & State", score: 84, level: "Proficient", totalEvaluated: 1 },
    { category: "Frontend Performance", score: 89, level: "Mastery", totalEvaluated: 1 },
    { category: "Technical Precision", score: 87, level: "Proficient", totalEvaluated: 3 },
  ],
  strengths: [
    "Demonstrated thorough understanding of Cache-Aside patterns and race-condition mitigation using distributed mutexes.",
    "Correctly explained fencing tokens for resolving lock lease expiration issues across network partitions.",
    "Strong grasp of React Server Components (RSC) and streaming SSR zero-bundle benefits for Core Web Vitals.",
  ],
  areasToImprove: [
    "Could elaborate further on multi-region write latency versus read-your-writes consensus guarantees.",
    "Recommend practicing practical code implementations of token bucket rate-limiting algorithms.",
  ],
  actionableRoadmap: [
    "Deep dive into Paxos/Raft consensus protocols for distributed state synchronization.",
    "Review Postgres EXPLAIN ANALYZE execution plans for complex join optimizations.",
    "Explore WebAssembly integration points for CPU-intensive browser micro-benchmarks.",
  ],
  answerRecords: [
    {
      questionId: "fs-1",
      questionText:
        "In a modern Next.js and Node.js microservice architecture, how would you design a resilient caching layer to minimize database load while preventing cache stampedes and stale data?",
      category: "System Architecture",
      difficulty: "intermediate",
      answerText:
        "I would implement a Redis Cache-Aside layer with TTL jitter to prevent stampedes. For critical high-throughput endpoints, I'd incorporate a distributed lock (mutex) with background revalidation using stale-while-revalidate headers, ensuring stale data is served momentarily while fresh data is compiled.",
      submittedAt: "10:14 AM",
      feedback: {
        score: 92,
        strengths: ["Highlighted TTL jitter", "Applied stale-while-revalidate principle", "Mentioned mutex concurrency controls"],
        gaps: ["Could mention fallback storage when Redis clusters degrade"],
        adaptiveNote: "Triggered follow-up on distributed lock boundary handling.",
      },
    },
    {
      questionId: "fs-2a",
      questionText:
        "Since you mentioned distributed locking, how do you handle lock expiry when a node process encounters prolonged garbage collection or a network partition before releasing the lock?",
      category: "Concurrency & State",
      difficulty: "advanced",
      answerText:
        "If a lock expires during a GC pause, another worker might acquire it, causing split-brain execution. To prevent this, I would use fencing tokens—monotonically increasing version numbers verified by the storage backend on write. If the token is outdated, the write is rejected.",
      submittedAt: "10:21 AM",
      feedback: {
        score: 86,
        strengths: ["Correctly identified fencing token mechanism", "Addressed split-brain hazards"],
        gaps: ["Brief on lease heartbeat extensions"],
        adaptiveNote: "Validated deep concurrency awareness.",
      },
    },
    {
      questionId: "fs-3",
      questionText:
        "How do React Server Components (RSC) and streaming SSR improve Core Web Vitals (LCP & INP) compared to traditional client-side SPA rendering?",
      category: "Frontend Performance",
      difficulty: "intermediate",
      answerText:
        "RSC moves heavy dependencies to the server, resulting in zero client JavaScript bundle impact. With streaming SSR and Suspense, the server streams shell HTML instantly for quick First Contentful Paint, while interactive chunks hydrate selectively, drastically reducing main-thread blocking and improving INP.",
      submittedAt: "10:29 AM",
      feedback: {
        score: 89,
        strengths: ["Zero-bundle size clarity", "Selective hydration boundary articulation", "Direct mapping to INP & LCP metrics"],
        gaps: ["Could touch upon server-side data prefetching waterfalls"],
        adaptiveNote: "Session successfully completed.",
      },
    },
  ],
  isDemoSimulation: true,
};

export const PRIYA_REPORT: EvaluationReport = {
  sessionId: "demo-session-priya",
  candidateName: "Priya Sharma",
  targetRole: "Frontend Developer",
  experienceLevel: "Intermediate",
  interviewFocus: "Core Concepts & Web Performance",
  completedAt: "Oct 10, 2026",
  durationMinutes: 16,
  overallScore: 78,
  verdict: "Hire Recommendation",
  shortlistStatus: "under-review",
  shortlistNotes: "Strong foundational knowledge of React 19 hooks and CSS performance. Scheduled for team cultural alignment.",
  userId: "usr_demo_priya",
  metrics: [
    { category: "Core React & State", score: 84, level: "Proficient", totalEvaluated: 1 },
    { category: "Web Performance", score: 76, level: "Developing", totalEvaluated: 1 },
    { category: "TypeScript & Types", score: 80, level: "Proficient", totalEvaluated: 1 },
    { category: "UI Architecture", score: 72, level: "Developing", totalEvaluated: 1 },
  ],
  strengths: [
    "Precise explanation of React rendering phases and state colocation benefits.",
    "Good understanding of layout shifts (CLS) and image aspect-ratio reserves.",
  ],
  areasToImprove: [
    "Deepen knowledge of micro-frontend module federation and memory leak mitigation.",
    "Explore advanced bundle code-splitting with dynamic import error boundaries.",
  ],
  actionableRoadmap: [
    "Practice using Chrome Performance tab for frame-rate and layout thrashing profiling.",
    "Implement custom hook unit tests using Vitest and React Testing Library.",
  ],
  answerRecords: [
    {
      questionId: "fe-1",
      questionText: "Explain the differences between client-side state managers and server-cache solutions. When is each preferred?",
      category: "Core React & State",
      difficulty: "intermediate",
      answerText: "Client state like Zustand is for transient UI state such as modal toggles or active filters. Server state like React Query manages remote data with automatic background refetching and deduplication.",
      submittedAt: "11:05 AM",
      feedback: {
        score: 84,
        strengths: ["Clean distinction between transient and cached state", "Mentioned deduplication"],
        gaps: ["Could discuss optimistic UI updates during network latency"],
        adaptiveNote: "Solid fundamental clarity.",
      },
    },
  ],
  isDemoSimulation: true,
};

export const MARCUS_REPORT: EvaluationReport = {
  sessionId: "demo-session-marcus",
  candidateName: "Marcus Chen",
  targetRole: "Backend Developer",
  experienceLevel: "Intermediate",
  interviewFocus: "DSA & Database Internals",
  completedAt: "Oct 9, 2026",
  durationMinutes: 14,
  overallScore: 54,
  verdict: "Additional Review Recommended",
  shortlistStatus: "under-review",
  shortlistNotes: "Demonstrated basic SQL queries but struggled with composite indexing and lock isolation levels under high concurrency.",
  userId: "usr_demo_marcus",
  metrics: [
    { category: "Database Internals", score: 58, level: "Needs Focus", totalEvaluated: 1 },
    { category: "System Reliability", score: 52, level: "Needs Focus", totalEvaluated: 1 },
    { category: "API Design", score: 62, level: "Developing", totalEvaluated: 1 },
  ],
  strengths: [
    "Accurately articulated the basics of RESTful error status codes and idempotent PUT/DELETE operations.",
  ],
  areasToImprove: [
    "Need deeper conceptual grasp of database ACID transaction isolation levels (Repeatable Read vs Serializable).",
    "Practice building circuit breaker patterns for downstream API failures.",
  ],
  actionableRoadmap: [
    "Study PostgreSQL MVCC (Multi-Version Concurrency Control) documentation.",
    "Implement an exponential backoff with jitter retry utility in Node.js.",
  ],
  answerRecords: [
    {
      questionId: "be-1",
      questionText: "How do you prevent SQL connection pool exhaustion during traffic spikes?",
      category: "Database Internals",
      difficulty: "intermediate",
      answerText: "By setting max connections in the pool config and using Redis to cache common queries.",
      submittedAt: "02:15 PM",
      feedback: {
        score: 54,
        strengths: ["Mentioned max pool connection bounds"],
        gaps: ["Did not mention connection timeout queues, read replicas, or circuit breaking"],
        adaptiveNote: "Candidate provided brief overview without failure mode analysis.",
      },
    },
  ],
  isDemoSimulation: true,
};

export const ROHAN_REPORT: EvaluationReport = {
  sessionId: "demo-session-rohan",
  candidateName: "Rohan Gupta",
  targetRole: "Python Developer",
  experienceLevel: "Beginner",
  interviewFocus: "Core Concepts",
  completedAt: "Oct 11, 2026",
  durationMinutes: 2,
  overallScore: 0,
  verdict: "Additional Review Recommended",
  shortlistStatus: "rejected",
  shortlistNotes: "Answers submitted were empty or missing technical keywords. Foundational preparation required before reconsidering.",
  userId: "usr_demo_rohan",
  metrics: [
    { category: "Python Internals", score: 0, level: "Needs Focus", totalEvaluated: 1 },
    { category: "Algorithms & Logic", score: 0, level: "Needs Focus", totalEvaluated: 1 },
    { category: "Data Structures", score: 0, level: "Needs Focus", totalEvaluated: 1 },
  ],
  strengths: [
    "Attempted session under timed environment.",
  ],
  areasToImprove: [
    "Complete technical responses with appropriate Python keywords and syntax.",
    "Review core data structures: lists, dictionaries, sets, and generator functions.",
  ],
  actionableRoadmap: [
    "Complete foundational Python programming tutorials and exercises.",
    "Solve beginner-level algorithm problems on LeetCode.",
  ],
  answerRecords: [
    {
      questionId: "py-1",
      questionText: "Explain how Python manages memory with reference counting and cyclic garbage collection.",
      category: "Python Internals",
      difficulty: "beginner",
      answerText: "",
      submittedAt: "09:30 AM",
      feedback: {
        score: 0,
        strengths: [],
        gaps: ["No answer text submitted."],
        adaptiveNote: "Candidate submitted blank response.",
      },
    },
  ],
  isDemoSimulation: true,
};

export const ALL_DEMO_REPORTS: EvaluationReport[] = [
  SAMPLE_REPORT,
  PRIYA_REPORT,
  MARCUS_REPORT,
  ROHAN_REPORT,
];
