import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';
import { InvalidJsonBodyError, readBoundedJson, RequestBodyTooLargeError } from '@/lib/bounded-json';

type Draft = { title: string; excerpt: string; content: string };
const MAX_AI_REQUEST_BYTES = 512 * 1024;
const MAX_DRAFT_TITLE_LENGTH = 160;
const MAX_DRAFT_EXCERPT_LENGTH = 500;
const MAX_DRAFT_CONTENT_LENGTH = 10000;

function parseDraft(value: string): Draft | null {
  const json = value.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const draft = JSON.parse(json) as Partial<Draft>;
    if (typeof draft.title !== 'string' || typeof draft.excerpt !== 'string' || typeof draft.content !== 'string') return null;
    const normalized = { title: draft.title.trim(), excerpt: draft.excerpt.trim(), content: draft.content.trim() };
    if (!normalized.title || !normalized.excerpt || !normalized.content) return null;
    if (normalized.title.length > MAX_DRAFT_TITLE_LENGTH || normalized.excerpt.length > MAX_DRAFT_EXCERPT_LENGTH || normalized.content.length > MAX_DRAFT_CONTENT_LENGTH) return null;
    return normalized;
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  if (!token || !verifyAdminToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.GOOGLE_AI_API_KEY) return NextResponse.json({ error: 'AI not available, please edit manually' }, { status: 503 });

  try {
    const body = await readBoundedJson(request, MAX_AI_REQUEST_BYTES);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const hasSubmissionId = typeof body.submission_id === 'string' && body.submission_id.trim() !== '';
    const hasArticleId = typeof body.article_id === 'string' && body.article_id.trim() !== '';
    if (hasSubmissionId && hasArticleId) return NextResponse.json({ error: 'Choose either a Story submission or an article, not both' }, { status: 400 });
    let title = typeof body.title === 'string' ? body.title : '';
    let facts = body.facts && typeof body.facts === 'object' && !Array.isArray(body.facts) ? body.facts : {};
    if (hasSubmissionId) {
      const { data, error } = await supabase.from('story_submissions').select('title, facts, content, excerpt, merchant_slug').eq('id', body.submission_id).single();
      if (error || !data) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
      title = data.title;
      facts = { ...data.facts, merchant_slug: data.merchant_slug, merchant_content: data.content, merchant_excerpt: data.excerpt };
    }
    if (hasArticleId) {
      const { data, error } = await supabase.from('articles').select('title, excerpt, content, merchant_slug').eq('id', body.article_id).single();
      if (error || !data) return NextResponse.json({ error: 'Article not found' }, { status: 404 });
      title = data.title;
      facts = { ...facts, merchant_slug: data.merchant_slug, current_content: data.content, current_excerpt: data.excerpt };
    }
    if (!title) return NextResponse.json({ error: 'title or submission_id is required' }, { status: 400 });

    const prompt = `You are an editorial assistant for BiteSite, a Malaysia restaurant discovery platform. Based on these merchant-provided facts, write a short editorial story (150-250 words). Language: English. Tone: friendly, factual, local. Do NOT invent prices or dates not in facts. Return only valid JSON with this exact shape: {"title":"...","excerpt":"...","content":"..."}. Suggested title: ${title}\nFacts: ${JSON.stringify(facts)}`;
    const model = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY).getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const draft = parseDraft(result.response.text());
    if (!draft) return NextResponse.json({ error: 'AI returned an invalid draft; please edit manually' }, { status: 502 });
    if (hasSubmissionId) {
      const { error: saveError } = await supabase.from('story_submissions').update({ generated_copy: draft, generated_copy_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', body.submission_id);
      if (saveError) return NextResponse.json({ error: 'AI draft generated but could not be saved; please edit manually' }, { status: 500 });
    }
    if (hasArticleId) {
      const { error: saveError } = await supabase.from('articles').update({ generated_copy: draft, generated_copy_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', body.article_id);
      if (saveError) return NextResponse.json({ error: 'AI draft generated but could not be saved; please edit manually' }, { status: 500 });
    }
    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
    if (error instanceof InvalidJsonBodyError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('AI draft error:', error);
    return NextResponse.json({ error: 'AI not available, please edit manually' }, { status: 503 });
  }
}
