import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { verifyAdminToken } from '@/lib/admin-auth';

type Draft = { title: string; excerpt: string; content: string };

function parseDraft(value: string): Draft | null {
  const json = value.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const draft = JSON.parse(json) as Partial<Draft>;
    return typeof draft.title === 'string' && typeof draft.excerpt === 'string' && typeof draft.content === 'string' ? draft as Draft : null;
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  if (!token || !verifyAdminToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.GOOGLE_AI_API_KEY) return NextResponse.json({ error: 'AI not available, please edit manually' }, { status: 503 });

  try {
    const body = await request.json();
    let title = typeof body.title === 'string' ? body.title : '';
    let facts = body.facts && typeof body.facts === 'object' ? body.facts : {};
    if (typeof body.submission_id === 'string') {
      const { data, error } = await supabase.from('story_submissions').select('title, facts, content, excerpt, merchant_slug').eq('id', body.submission_id).single();
      if (error || !data) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
      title = data.title;
      facts = { ...data.facts, merchant_slug: data.merchant_slug, merchant_content: data.content, merchant_excerpt: data.excerpt };
    }
    if (!title) return NextResponse.json({ error: 'title or submission_id is required' }, { status: 400 });

    const prompt = `You are an editorial assistant for BiteSite, a Malaysia restaurant discovery platform. Based on these merchant-provided facts, write a short editorial story (150-250 words). Language: English. Tone: friendly, factual, local. Do NOT invent prices or dates not in facts. Return only valid JSON with this exact shape: {"title":"...","excerpt":"...","content":"..."}. Suggested title: ${title}\nFacts: ${JSON.stringify(facts)}`;
    const model = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY).getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const draft = parseDraft(result.response.text());
    if (!draft) return NextResponse.json({ error: 'AI returned an invalid draft; please edit manually' }, { status: 502 });
    return NextResponse.json({ draft });
  } catch (error) {
    console.error('AI draft error:', error);
    return NextResponse.json({ error: 'AI not available, please edit manually' }, { status: 503 });
  }
}
