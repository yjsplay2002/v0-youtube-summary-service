import { NextRequest, NextResponse } from 'next/server';
import { feedbackSupabase } from '@/lib/feedback-supabase';
import { supabase } from '@/app/lib/supabase';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
  
  try {
    // Get recent feedback posts for dynamic sitemap
    const { data: feedbackPosts } = await feedbackSupabase
      .from('feedback_posts')
      .select('id, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(50); // Limit to recent posts

    // Get video summaries from database
    const { data: videoSummaries } = await supabase
      .from('video_summaries')
      .select('video_id, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(100); // Limit to recent summaries

    // Get static summary files
    let staticSummaries: string[] = [];
    try {
      const summariesPath = path.join(process.cwd(), 'summaries');
      if (fs.existsSync(summariesPath)) {
        staticSummaries = fs.readdirSync(summariesPath)
          .filter(file => file.endsWith('.md'))
          .map(file => file.replace('.md', ''));
      }
    } catch (error) {
      console.error('Error reading summaries directory:', error);
    }

    const currentDate = new Date().toISOString();
    
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  
  <!-- Main Application Pages -->
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/landing</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/community</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/feedback</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>

  <!-- Authentication Pages -->
  <url>
    <loc>${baseUrl}/auth/callback</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>

  <!-- Video Summary Pages (from database) -->
  ${videoSummaries?.map(summary => `
  <url>
    <loc>${baseUrl}/?videoId=${summary.video_id}</loc>
    <lastmod>${summary.updated_at || summary.created_at}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('') || ''}

  <!-- Static Video Summary Pages -->
  ${staticSummaries.map(videoId => `
  <url>
    <loc>${baseUrl}/?videoId=${videoId}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`).join('')}

  <!-- Community Feedback Posts -->
  ${feedbackPosts?.map(post => `
  <url>
    <loc>${baseUrl}/community#post-${post.id}</loc>
    <lastmod>${post.updated_at || post.created_at}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`).join('') || ''}
  
</urlset>`;

    return new NextResponse(sitemap, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'X-Robots-Tag': 'noindex', // Don't index the sitemap itself
      },
    });

  } catch (error) {
    console.error('Error generating sitemap:', error);
    
    // Fallback static sitemap if dynamic generation fails
    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/landing</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/community</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/feedback</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>`;

    return new NextResponse(fallbackSitemap, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=1800, s-maxage=1800', // Shorter cache for fallback
      },
    });
  }
}