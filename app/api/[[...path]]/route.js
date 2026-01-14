import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Utility function to add CORS headers
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET(request) {
  const { pathname, searchParams } = new URL(request.url);
  const path = pathname.replace('/api', '') || '/';

  try {
    // Health check endpoint
    if (path === '/' || path === '') {
      return NextResponse.json(
        { 
          message: 'Cerebro Visas API is running',
          version: '1.0.0',
          timestamp: new Date().toISOString()
        },
        { headers: corsHeaders() }
      );
    }

    // Get all cases
    if (path === '/cases') {
      const { data, error } = await supabaseAdmin
        .from('cases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ cases: data }, { headers: corsHeaders() });
    }

    // Get all documents
    if (path === '/documents') {
      const { data, error } = await supabaseAdmin
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ documents: data }, { headers: corsHeaders() });
    }

    // Get statistics
    if (path === '/stats') {
      const [casesResult, docsResult, profilesResult] = await Promise.all([
        supabaseAdmin.from('cases').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('documents').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true })
      ]);

      return NextResponse.json({
        stats: {
          totalCases: casesResult.count || 0,
          totalDocuments: docsResult.count || 0,
          totalUsers: profilesResult.count || 0
        }
      }, { headers: corsHeaders() });
    }

    return NextResponse.json(
      { error: 'Route not found' },
      { status: 404, headers: corsHeaders() }
    );

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function POST(request) {
  const { pathname } = new URL(request.url);
  const path = pathname.replace('/api', '') || '/';

  try {
    const body = await request.json();

    // Create a new case
    if (path === '/cases') {
      const { title, description, visa_category, outcome, filed_date, service_center, created_by } = body;
      
      const { data, error } = await supabaseAdmin
        .from('cases')
        .insert({
          title,
          description,
          visa_category: visa_category || 'EB-2 NIW',
          outcome: outcome || 'pending',
          filed_date,
          service_center,
          created_by
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ case: data }, { status: 201, headers: corsHeaders() });
    }

    // Create a new document
    if (path === '/documents') {
      const { name, description, case_id, storage_path, doc_type, created_by } = body;
      
      const { data, error } = await supabaseAdmin
        .from('documents')
        .insert({
          name,
          description,
          case_id,
          storage_path,
          doc_type: doc_type || 'RFE',
          created_by
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ document: data }, { status: 201, headers: corsHeaders() });
    }

    return NextResponse.json(
      { error: 'Route not found' },
      { status: 404, headers: corsHeaders() }
    );

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function PUT(request) {
  const { pathname } = new URL(request.url);
  const path = pathname.replace('/api', '') || '/';

  try {
    const body = await request.json();

    // Update user role (admin only)
    if (path.startsWith('/users/') && path.endsWith('/role')) {
      const userId = path.split('/')[2];
      const { role } = body;

      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({ role })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ profile: data }, { headers: corsHeaders() });
    }

    return NextResponse.json(
      { error: 'Route not found' },
      { status: 404, headers: corsHeaders() }
    );

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
