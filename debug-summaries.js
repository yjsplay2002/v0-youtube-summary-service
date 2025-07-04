// Debug script to test Supabase connection and data retrieval
const { createClient } = require('@supabase/supabase-js');

async function debugSummaries() {
  console.log('🔍 Starting Supabase debug...');
  
  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('📋 Environment variables:');
  console.log('- SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.log('- SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Set' : '❌ Missing');
  console.log('- SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing');
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing required environment variables');
    return;
  }
  
  // Test with anon client
  console.log('\n🔐 Testing with anon client...');
  const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    const { data: anonData, error: anonError } = await supabaseAnon
      .from('video_summaries')
      .select('video_id, video_title, user_id, created_at')
      .limit(5);
    
    if (anonError) {
      console.error('❌ Anon client error:', anonError);
    } else {
      console.log('✅ Anon client success:', anonData?.length || 0, 'records');
      if (anonData?.length > 0) {
        console.log('📝 Sample data:', anonData[0]);
      }
    }
  } catch (err) {
    console.error('❌ Anon client exception:', err.message);
  }
  
  // Test with service role client (if available)
  if (supabaseServiceKey) {
    console.log('\n🔑 Testing with service role client...');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    
    try {
      const { data: adminData, error: adminError } = await supabaseAdmin
        .from('video_summaries')
        .select('video_id, video_title, user_id, created_at')
        .limit(5);
      
      if (adminError) {
        console.error('❌ Admin client error:', adminError);
      } else {
        console.log('✅ Admin client success:', adminData?.length || 0, 'records');
        if (adminData?.length > 0) {
          console.log('📝 Sample data:', adminData[0]);
        }
      }
    } catch (err) {
      console.error('❌ Admin client exception:', err.message);
    }
  }
  
  // Test table structure
  console.log('\n📊 Testing table structure...');
  const supabaseTest = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);
  
  try {
    const { data: tableInfo, error: tableError } = await supabaseTest
      .from('video_summaries')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Table structure error:', tableError);
    } else {
      console.log('✅ Table accessible');
      if (tableInfo && tableInfo.length > 0) {
        console.log('📋 Table columns:', Object.keys(tableInfo[0]));
      }
    }
  } catch (err) {
    console.error('❌ Table structure exception:', err.message);
  }
  
  console.log('\n🏁 Debug complete');
}

// Note: Run this with: npm run dev (to load Next.js env vars)
// or manually set environment variables

if (require.main === module) {
  debugSummaries().catch(console.error);
}