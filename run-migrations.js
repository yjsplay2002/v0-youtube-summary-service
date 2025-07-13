const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client with service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hffgrebfohhhegkreakn.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmZmdyZWJmb2hoaGVna3JlYWtuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzMxNjc5MCwiZXhwIjoyMDYyODkyNzkwfQ.r5BTuTh8W3CPHzze5XjLv898CLKWNJxhuPoRavaJquA';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runMigrations() {
  console.log('🚀 Starting database migrations...');
  
  const migrationFiles = [
    '017_create_video_info_table.sql',
    '018_migrate_video_summaries_to_new_structure.sql', 
    '019_remove_redundant_fields_from_video_summaries.sql'
  ];
  
  for (const filename of migrationFiles) {
    console.log(`\n📁 Running migration: ${filename}`);
    
    try {
      const filePath = path.join(__dirname, 'supabase', 'migrations', filename);
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      
      // Split the SQL content by semicolons to run individual statements
      const statements = sqlContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement) {
          console.log(`  💫 Executing statement ${i + 1}/${statements.length}...`);
          const { data, error } = await supabase.rpc('sql', { query: statement });
          
          if (error) {
            console.error(`  ❌ Error in statement ${i + 1}:`, error);
            throw error;
          }
          console.log(`  ✅ Statement ${i + 1} completed successfully`);
        }
      }
      
      console.log(`✅ Migration ${filename} completed successfully`);
      
    } catch (error) {
      console.error(`❌ Migration ${filename} failed:`, error);
      throw error;
    }
  }
  
  console.log('\n🎉 All migrations completed successfully!');
  
  // Verify the migration by checking the tables
  console.log('\n📊 Verifying migration results...');
  
  const { data: videoInfo, error: videoInfoError } = await supabase
    .from('video_info')
    .select('count(*)', { count: 'exact', head: true });
    
  const { data: videoSummaries, error: videoSummariesError } = await supabase
    .from('video_summaries')
    .select('count(*)', { count: 'exact', head: true });
  
  if (videoInfoError || videoSummariesError) {
    console.error('Error verifying migration:', { videoInfoError, videoSummariesError });
  } else {
    console.log(`📈 video_info table: ${videoInfo?.length || 0} records`);
    console.log(`📈 video_summaries table: ${videoSummaries?.length || 0} records`);
  }
}

runMigrations().catch(console.error);