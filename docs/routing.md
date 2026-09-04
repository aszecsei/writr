# Routing

Next.js App Router (`src/app/`). Every page is `"use client"` because data lives in IndexedDB. The only server-side code is the AI proxy.

## Pages

```
/                                            Dashboard / project picker
/brainstorm                                  Brainstorm workspace
/projects/[projectId]                        Project overview (sidebar + topbar layout)
/projects/[projectId]/chapters/[chapterId]   Chapter editor (TipTap)
/projects/[projectId]/outline                Outline grid view
/projects/[projectId]/search                 Project-wide search
/projects/[projectId]/agents                       Agent list (Global / Project), links to editors
/projects/[projectId]/agents/definitions/new       New agent-definition editor
/projects/[projectId]/agents/definitions/[agentId] Agent-definition editor (built-in or user)

/projects/[projectId]/bible                  Story bible overview
/projects/[projectId]/bible/characters       Character list
/projects/[projectId]/bible/characters/[id]  Character detail
/projects/[projectId]/bible/locations        Location list
/projects/[projectId]/bible/locations/[id]   Location detail
/projects/[projectId]/bible/timeline         Timeline editor
/projects/[projectId]/bible/style-guide      Style guide entries
/projects/[projectId]/bible/worldbuilding    Worldbuilding doc list
/projects/[projectId]/bible/worldbuilding/[docId]  Worldbuilding doc editor
/projects/[projectId]/bible/family-tree      Character relationship diagram (XYFlow)
/projects/[projectId]/bible/playlist         Music/mood playlist (YouTube)
```

The project layout (`src/app/projects/[projectId]/layout.tsx`) renders the sidebar, topbar, and shared modals.

## API

```
POST /api/ai     Proxy to LLM providers (Anthropic, OpenAI, Google).
                 The handler picks a provider based on the agent config or
                 explicit override and streams the response back to the client.
```

There are no other server routes — nothing else is allowed to need a server.

## Conventions

- Don't add server-rendered routes for entity data; everything lives in IndexedDB and routes need `"use client"`.
- New pages should fetch data through `src/hooks/data/` hooks, not by importing operations directly into the page.
