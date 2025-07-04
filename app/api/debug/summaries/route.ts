import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/app/lib/supabase';

export async function GET(request: NextRequest) {
  const debug = {
    timestamp: new Date().toISOString(),
    environment: {
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      nodeEnv: process.env.NODE_ENV,
    },
    tests: {
      anonClient: null,
      adminClient: null,
      tableStructure: null,
    }
  };

  // Test with anon client
  try {
    const { data: anonData, error: anonError } = await supabase
      .from('video_summaries')
      .select('video_id, video_title, user_id, created_at')
      .limit(3);
    
    debug.tests.anonClient = {
      success: !anonError,
      error: anonError?.message,
      recordCount: anonData?.length || 0,
      sampleData: anonData?.[0] || null
    };
  } catch (err) {
    debug.tests.anonClient = {
      success: false,
      error: err.message,
      recordCount: 0
    };
  }

  // Test with admin client
  try {
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('video_summaries')
      .select('video_id, video_title, user_id, created_at')
      .limit(3);
    
    debug.tests.adminClient = {
      success: !adminError,
      error: adminError?.message,
      recordCount: adminData?.length || 0,
      sampleData: adminData?.[0] || null
    };
  } catch (err) {
    debug.tests.adminClient = {
      success: false,
      error: err.message,
      recordCount: 0
    };
  }

  // Test table structure
  try {
    const { data: structureData, error: structureError } = await supabaseAdmin
      .from('video_summaries')
      .select('*')
      .limit(1);
    
    debug.tests.tableStructure = {
      success: !structureError,
      error: structureError?.message,
      columns: structureData?.[0] ? Object.keys(structureData[0]) : []
    };
  } catch (err) {
    debug.tests.tableStructure = {
      success: false,
      error: err.message,
      columns: []
    };
  }

  return NextResponse.json(debug, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}