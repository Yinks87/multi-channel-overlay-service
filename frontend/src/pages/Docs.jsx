import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import StreamIcon from '@mui/icons-material/Stream';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { endpointSections } from './assets/rest';
import { sseSections, sseConnectionSnippet } from './assets/sse';

const BASE = import.meta.env.VITE_CUSTOM_TABLES_API_BASE;
const SSE_ENDPOINT = import.meta.env.VITE_SSE_ENDPOINT;

/* ── Category / section tree used for sidebar nav ───────────────────────── */

const categories = [
  {
    id: 'custom-tables',
    title: 'Custom Tables API',
    icon: StorageIcon,
    subsections: [
      { id: 'rest-endpoints', title: 'REST Endpoints' },
      { id: 'sse-recurring-snippets', title: 'SSE Recurring Snippets' },
      { id: 'sse-events', title: 'Realtime Events (SSE)' },
    ],
  },
];

const recurringSseSnippets = [
  {
    id: 'search-params',
    title: 'Search Params',
    description: 'Read URL query params once and reuse the values.',
    code: `// Load params from the URL query string
const searchParams = new URLSearchParams(window.location.search);
const param = searchParams.get('param');`,
  },
  {
    id: 'eventsource-open',
    title: 'EventSource Open',
    description: 'Log when the SSE connection has been opened.',
    code: `source.addEventListener('open', () => {
  console.log('[SSE] Connection opened');
});`,
  },
  {
    id: 'eventsource-error',
    title: 'EventSource Error',
    description: 'Track connection issues and auto-reconnect behavior.',
    code: `source.addEventListener('error', (e) => {
  console.error('[SSE] Connection error:', e);

  if (source.readyState === EventSource.CLOSED) {
    console.warn('[SSE] Connection closed. EventSource will retry automatically.');
  }
});`,
  },
  {
    id: 'dom-content-loaded',
    title: 'DOMContentLoaded',
    description: 'Fetch initial data after the page has loaded.',
    code: `window.addEventListener('DOMContentLoaded', async () => {
  const data = await fetch(
    'https://<backend-origin.com>/api/v1/custom-tables/row/<table_name>?key=param&keyValue=' +
      encodeURIComponent(param ?? ''),
  );

  if (!data.ok) {
    console.error('[SSE] Failed to fetch initial data:', data.statusText);
    return;
  }

  const jsonData = await data.json();
  const rowData = jsonData.data;
  updateUI(rowData);
});`,
  },
];

function getTopicBaseSnippet(eventName) {
  return `// 1) Load params from the URL query string
const searchParams = new URLSearchParams(window.location.search);
const param = searchParams.get('param');

// 2) Create an EventSource for the required topic(s)
const source = new EventSource(
  '${SSE_ENDPOINT ?? '/clients'}?topics=${eventName}'
);

// 3) Track connection lifecycle
source.addEventListener('open', () => {
  console.log('[SSE] Connection opened');
});

source.addEventListener('error', (e) => {
  console.error('[SSE] Connection error:', e);
});

// 4) Handle this topic
source.addEventListener('${eventName}', (e) => {
  const payload = JSON.parse(e.data);
  console.log('[SSE] ${eventName}', payload);
  // TODO: update your UI here
});

// 5) Optional: load initial data before events arrive
window.addEventListener('DOMContentLoaded', async () => {
  const data = await fetch(
    'https://<backend-origin.com>/api/v1/custom-tables/row/<table_name>?key=param&keyValue=' +
      encodeURIComponent(param ?? ''),
  );

  if (!data.ok) {
    console.error('[SSE] Failed to fetch initial data:', data.statusText);
    return;
  }

  const jsonData = await data.json();
  const rowData = jsonData.data;
  updateUI(rowData);
});`;
}

/* ── Shared components ──────────────────────────────────────────────────── */

// All collapse states live in one localStorage key to avoid clutter
function useCollapseState(key) {
  const [open, setOpen] = useState(() => {
    try {
      const all = JSON.parse(localStorage.getItem('docs_collapse') ?? '{}');
      return all[key] ?? false;
    } catch {
      return false;
    }
  });

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        const all = JSON.parse(localStorage.getItem('docs_collapse') ?? '{}');
        localStorage.setItem(
          'docs_collapse',
          JSON.stringify({ ...all, [key]: next }),
        );
      } catch {}
      return next;
    });
  };

  return [open, toggle];
}

function useClipboardState(duration = 2000) {
  const [copied, setCopied] = useState(false);

  const copy = async (value) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(String(value));
      } else {
        const el = document.createElement('textarea');
        el.value = String(value);
        el.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), duration);
    } catch {
      setCopied(false);
    }
  };

  return { copied, copy };
}

function CollapsibleSection({ label, storageKey, children, rightAction }) {
  const [open, toggle] = useCollapseState(storageKey);
  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box
          onClick={toggle}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            py: 0.75,
            cursor: 'pointer',
            userSelect: 'none',
            '&:hover .col-label': { color: '#fff' },
            flex: 1,
          }}
        >
          <ChevronRightIcon
            sx={{
              fontSize: 15,
              color: 'rgba(255,255,255,0.35)',
              transform: open ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          />
          <Typography
            className="col-label"
            variant="subtitle2"
            fontWeight={700}
            sx={{
              color: 'rgba(255,255,255,0.55)',
              transition: 'color 0.1s',
              fontSize: 12,
            }}
          >
            {label}
          </Typography>
        </Box>
        {rightAction}
      </Box>
      {open && <Box sx={{ mt: 0.25 }}>{children}</Box>}
    </Box>
  );
}

function CopyButton({ value, label = 'Copy', size = 'small' }) {
  const { copied, copy } = useClipboardState();

  return (
    <Button
      size={size}
      variant="outlined"
      onClick={() => copy(value)}
      startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
      color={copied ? 'success' : 'inherit'}
      sx={{
        textTransform: 'none',
        minWidth: 90,
        borderColor: 'rgba(255,255,255,0.22)',
      }}
    >
      {copied ? 'Copied!' : label}
    </Button>
  );
}

function CodeBlock({ children, language = 'javascript' }) {
  return (
    <SyntaxHighlighter
      language={language}
      style={vscDarkPlus}
      customStyle={{
        margin: 0,
        borderRadius: 8,
        fontSize: 13,
        lineHeight: 1.6,
        border: '1px solid rgba(255,255,255,0.08)',
        background: '#0f1720',
      }}
      wrapLongLines
    >
      {String(children).replace(/\n$/, '')}
    </SyntaxHighlighter>
  );
}

function EventChip() {
  return (
    <Chip
      label="SSE"
      size="small"
      sx={{ fontWeight: 700, bgcolor: '#7c3aed', color: '#fff' }}
    />
  );
}

function MethodChip({ method }) {
  const colorMap = {
    GET: 'info',
    POST: 'success',
    PATCH: 'warning',
    DELETE: 'error',
  };
  return (
    <Chip
      label={method}
      color={colorMap[method] || 'default'}
      size="small"
      sx={{ fontWeight: 700 }}
    />
  );
}

/* ── Section renderers ──────────────────────────────────────────────────── */

function RestEndpointCard({ section }) {
  return (
    <Paper
      key={`${section.method}-${section.title}`}
      sx={{
        p: 2.5,
        border: '1px solid rgba(255,255,255,0.08)',
        bgcolor: '#14141d',
      }}
    >
      <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}>
        <MethodChip method={section.method} />
        <Typography variant="h6" fontWeight={700}>
          {section.title}
        </Typography>
      </Stack>

      <Typography variant="body2" sx={{ mb: 0.5 }}>
        <strong>Path:</strong> {section.path}
      </Typography>
      <Typography variant="body2" sx={{ mb: 0.5 }}>
        <strong>Protection:</strong> {section.auth}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {section.description}
      </Typography>

      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
        Request
      </Typography>
      <CodeBlock language="http">{section.requestExample}</CodeBlock>

      <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.08)' }} />

      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
        Response
      </Typography>
      <CodeBlock language="json">{section.responseExample}</CodeBlock>

      <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.08)' }} />

      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
        Notes
      </Typography>
      <Stack spacing={0.75}>
        {section.notes.map((note) => (
          <Typography key={note} variant="body2" color="text.secondary">
            - {note}
          </Typography>
        ))}
      </Stack>
    </Paper>
  );
}

function SseEventCard({ section }) {
  const topicBaseSnippet = getTopicBaseSnippet(section.event);

  return (
    <Paper
      sx={{
        p: 2.5,
        border: section.warning
          ? '1px solid rgba(239,68,68,0.35)'
          : '1px solid rgba(124,58,237,0.2)',
        bgcolor: '#14141d',
      }}
    >
      <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}>
        <EventChip />
        <Typography
          variant="h6"
          fontWeight={700}
          sx={{ fontFamily: 'monospace', fontSize: 15 }}
        >
          Topic: {section.event}
        </Typography>
        <CopyButton value={section.event} label="Copy Topic" />
      </Stack>

      {section.warning && (
        <Paper
          sx={{
            p: 1.5,
            mb: 2,
            bgcolor: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
          }}
        >
          <Typography
            variant="body2"
            sx={{ color: '#f87171', fontWeight: 600 }}
          >
            ⚠ {section.warning}
          </Typography>
        </Paper>
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {section.description}
      </Typography>

      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
        Snippets
      </Typography>

      <Stack spacing={1.5}>
        <CollapsibleSection
          label="Base Layout"
          storageKey={`sse_${section.event}_base_layout`}
          rightAction={
            <CopyButton
              value={topicBaseSnippet}
              label="Copy Code"
              size="small"
            />
          }
        >
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Full starter layout with search params, connection open/error
            listeners, topic listener and optional DOMContentLoaded preload.
          </Typography>
          <CodeBlock language="javascript">{topicBaseSnippet}</CodeBlock>
        </CollapsibleSection>

        <CollapsibleSection
          label="Listener"
          storageKey={`sse_${section.event}_listener`}
          rightAction={
            <CopyButton
              value={section.listenerSnippet}
              label="Copy Code"
              size="small"
            />
          }
        >
          <CodeBlock language="javascript">{section.listenerSnippet}</CodeBlock>
        </CollapsibleSection>

        <CollapsibleSection
          label="Payload Schema"
          storageKey={`sse_${section.event}_schema`}
          rightAction={
            <CopyButton
              value={section.payloadSchema}
              label="Copy Code"
              size="small"
            />
          }
        >
          <CodeBlock language="typescript">{section.payloadSchema}</CodeBlock>
        </CollapsibleSection>
        <CollapsibleSection
          label="Payload Example"
          storageKey={`sse_${section.event}_example`}
          rightAction={
            <CopyButton
              value={section.payloadExample}
              label="Copy Code"
              size="small"
            />
          }
        >
          <CodeBlock language="json">{section.payloadExample}</CodeBlock>
        </CollapsibleSection>
      </Stack>

      <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.08)' }} />

      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
        Notes
      </Typography>
      <Stack spacing={0.75}>
        {section.notes.map((note) => (
          <Typography key={note} variant="body2" color="text.secondary">
            - {note}
          </Typography>
        ))}
      </Stack>
    </Paper>
  );
}

function RecurringSnippetsCard() {
  return (
    <Paper
      sx={{
        p: 2.5,
        mb: 3,
        bgcolor: 'rgba(124,58,237,0.08)',
        border: '1px solid rgba(124,58,237,0.2)',
      }}
    >
      <Typography variant="h6" fontWeight={700} gutterBottom>
        Recurring SSE Snippets
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Reusable building blocks for most overlay scripts. Expand and copy the
        exact snippets you need.
      </Typography>

      <Stack spacing={1.5}>
        {recurringSseSnippets.map((snippet) => (
          <CollapsibleSection
            key={snippet.id}
            label={snippet.title}
            storageKey={`recurring_${snippet.id}`}
            rightAction={
              <CopyButton value={snippet.code} label="Copy Code" size="small" />
            }
          >
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {snippet.description}
            </Typography>
            <CodeBlock language="javascript">{snippet.code}</CodeBlock>
          </CollapsibleSection>
        ))}
      </Stack>
    </Paper>
  );
}

/* ── Sidebar nav ────────────────────────────────────────────────────────── */

function SidebarNav({ activeId, onSelect }) {
  return (
    <Box
      sx={{
        width: 220,
        flexShrink: 0,
        position: 'sticky',
        top: 24,
        alignSelf: 'flex-start',
      }}
    >
      {categories.map((cat) => {
        const CatIcon = cat.icon;
        return (
          <Box key={cat.id} sx={{ mb: 2 }}>
            <Stack
              direction="row"
              spacing={0.75}
              sx={{ alignItems: 'center', mb: 0.5, px: 1 }}
            >
              <CatIcon sx={{ fontSize: 15, color: '#309abd' }} />
              <Typography
                variant="caption"
                fontWeight={700}
                color="#309abd"
                sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}
              >
                {cat.title}
              </Typography>
            </Stack>
            {cat.subsections.map((sub) => (
              <Box
                key={sub.id}
                onClick={() => onSelect(sub.id)}
                sx={{
                  px: 2,
                  py: 0.75,
                  borderRadius: 1,
                  marginBottom: 0.5,
                  cursor: 'pointer',
                  bgcolor:
                    activeId === sub.id
                      ? 'rgba(48,154,189,0.12)'
                      : 'transparent',
                  borderLeft:
                    activeId === sub.id
                      ? '2px solid #309abd'
                      : '2px solid transparent',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                }}
              >
                <Typography
                  variant="body2"
                  fontWeight={activeId === sub.id ? 700 : 400}
                  color={activeId === sub.id ? '#309abd' : 'text.secondary'}
                >
                  {sub.title}
                </Typography>
              </Box>
            ))}
          </Box>
        );
      })}
    </Box>
  );
}

/* ── Main Docs component ────────────────────────────────────────────────── */

const Docs = () => {
  const [activeSection, setActiveSection] = useState('rest-endpoints');

  const sectionRefs = useRef({});

  const scrollTo = (id) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        Documentation
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Reference for the Custom Tables REST API and realtime SSE events.
      </Typography>

      <Box sx={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
        <SidebarNav activeId={activeSection} onSelect={scrollTo} />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* ── REST Endpoints ── */}
          <Box
            ref={(el) => {
              sectionRefs.current['rest-endpoints'] = el;
            }}
            sx={{ mb: 6 }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', mb: 1 }}
            >
              <StorageIcon sx={{ color: '#309abd' }} />
              <Typography variant="h5" fontWeight={800}>
                REST Endpoints
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Endpoints under <strong>{BASE}</strong> for reading, inserting,
              updating and deleting rows in custom tables. None of these
              endpoints require authentication.
            </Typography>

            <Paper
              sx={{
                p: 2.5,
                mb: 3,
                bgcolor: 'rgba(48,154,189,0.08)',
                border: '1px solid rgba(48,154,189,0.18)',
              }}
            >
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Important — updates without a primary key
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                The GET endpoint returns <strong>__rowid__</strong> for every
                row. If a table has no primary key, send{' '}
                <strong>key: "rowid"</strong> for PATCH or DELETE and use the{' '}
                <strong>__rowid__</strong> value as <strong>keyValue</strong>.
              </Typography>
              <CodeBlock language="json">{`{
  "key": "rowid",
  "keyValue": 7,
  "data": { "message": "Updated value" }
}`}</CodeBlock>
              <Stack
                direction="row"
                justifyContent="flex-end"
                sx={{ mt: 1.25 }}
              >
                <CopyButton
                  value={`{
  "key": "rowid",
  "keyValue": 7,
  "data": { "message": "Updated value" }
}`}
                  label="Copy Example"
                  size="small"
                />
              </Stack>
            </Paper>

            <Stack spacing={3}>
              {endpointSections.map((s) => (
                <RestEndpointCard key={`${s.method}-${s.title}`} section={s} />
              ))}
            </Stack>
          </Box>

          {/* ── SSE Events ── */}
          <Box
            ref={(el) => {
              sectionRefs.current['sse-recurring-snippets'] = el;
            }}
            sx={{ mb: 6 }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', mb: 1 }}
            >
              <StreamIcon sx={{ color: '#7c3aed' }} />
              <Typography variant="h5" fontWeight={800}>
                SSE Recurring Snippets
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Reusable snippets copied from the common overlay pattern used in
              moderators.js.
            </Typography>
            <RecurringSnippetsCard />
          </Box>

          {/* ── SSE Events ── */}
          <Box
            ref={(el) => {
              sectionRefs.current['sse-events'] = el;
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', mb: 1 }}
            >
              <StreamIcon sx={{ color: '#7c3aed' }} />
              <Typography variant="h5" fontWeight={800}>
                Realtime Events (SSE)
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Connect with <code>EventSource</code> and subscribe to the exact
              topics your overlay needs. A connection without a{' '}
              <code>topics</code> parameter receives nothing.
            </Typography>

            <Paper
              sx={{
                p: 2.5,
                mb: 3,
                bgcolor: 'rgba(124,58,237,0.08)',
                border: '1px solid rgba(124,58,237,0.2)',
              }}
            >
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Connection setup
              </Typography>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                Pass a comma-separated <code>topics</code> query parameter with
                every event name your overlay needs.{' '}
                <strong style={{ color: 'rgba(255, 135, 22, 0.75)' }}>
                  Only subscribed events are delivered
                </strong>{' '}
                — a connection without <code>topics</code> receives nothing.
              </Typography>
              <CodeBlock language="javascript">
                {sseConnectionSnippet}
              </CodeBlock>
              <Stack
                direction="row"
                justifyContent="flex-end"
                sx={{ mt: 1.25 }}
              >
                <CopyButton
                  value={sseConnectionSnippet}
                  label="Copy Connection"
                  size="small"
                />
              </Stack>
              <Stack spacing={0.75} sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  - The server sends a <code>: ping</code> comment every 25 s to
                  keep the connection alive through proxies.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  - <code>EventSource</code> reconnects automatically on network
                  errors — no extra code needed.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  - Use named <code>addEventListener</code> calls, not{' '}
                  <code>onmessage</code>, because all events are typed.
                </Typography>
              </Stack>
            </Paper>

            <Stack spacing={3}>
              {sseSections.map((s) => (
                <SseEventCard key={s.event} section={s} />
              ))}
            </Stack>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Docs;
