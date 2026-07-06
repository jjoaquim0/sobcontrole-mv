async function check() {
  const url = 'https://qxcchymwswontqcwqogm.supabase.co/rest/v1/?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4Y2NoeW13c3dvbnRxY3dxb2dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTE0MzUsImV4cCI6MjA5Njc4NzQzNX0.WfwTVOby8U7171gWU96_w1BcHW7R3SqaJsaFoj5QDYo';
  try {
    const r = await fetch(url);
    const data = await r.json();
    
    // Check definitions (Swagger 2) or components (OpenAPI 3)
    const schemas = data.definitions || (data.components && data.components.schemas) || {};
    const tables = Object.keys(schemas);
    console.log('Tables in database:', tables);
    
    if (schemas['companies']) {
      console.log('companies properties:', Object.keys(schemas['companies'].properties));
    } else {
      console.log('companies table not found in schemas.');
    }
    
    if (schemas['profiles']) {
      console.log('profiles properties:', Object.keys(schemas['profiles'].properties));
    }
  } catch(e) {
    console.error(e);
  }
}
check();
