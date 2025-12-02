const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { verifyAuth } = require('./middleware/auth');
const supabase = require('./config/supabase');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// CORS configuration - allow Vercel deployment URL and localhost
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  'http://localhost:3000',
  'http://localhost:3001'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins in production for now
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'DA6 Form Generator API is running' });
});

// Auth routes
app.get('/api/auth/user', verifyAuth, async (req, res) => {
  try {
    // Get user profile from database
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    res.json({
      user: req.user,
      profile: profile || null
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// DA6 Forms routes
app.get('/api/da6-forms', verifyAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('da6_forms')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ forms: data || [] });
  } catch (error) {
    console.error('Error fetching DA6 forms:', error);
    res.status(500).json({ error: 'Failed to fetch DA6 forms' });
  }
});

app.get('/api/da6-forms/:id', verifyAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('da6_forms')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Form not found' });
    }
    res.json({ form: data });
  } catch (error) {
    console.error('Error fetching DA6 form:', error);
    res.status(500).json({ error: 'Failed to fetch DA6 form' });
  }
});

app.post('/api/da6-forms', verifyAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('da6_forms')
      .insert({
        user_id: req.user.id,
        form_data: req.body.form_data,
        unit_name: req.body.unit_name,
        period_start: req.body.period_start,
        period_end: req.body.period_end,
        status: req.body.status || 'draft',
        cancelled_date: req.body.cancelled_date || null
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ form: data });
  } catch (error) {
    console.error('Error creating DA6 form:', error);
    res.status(500).json({ error: 'Failed to create DA6 form' });
  }
});

app.put('/api/da6-forms/:id', verifyAuth, async (req, res) => {
  try {
    const updateData = {
      form_data: req.body.form_data,
      unit_name: req.body.unit_name,
      period_start: req.body.period_start,
      period_end: req.body.period_end,
      status: req.body.status,
      updated_at: new Date().toISOString()
    };
    
    // Only set cancelled_date if status is 'cancelled' and cancelled_date is provided
    if (req.body.status === 'cancelled' && req.body.cancelled_date) {
      updateData.cancelled_date = req.body.cancelled_date;
    } else if (req.body.status !== 'cancelled') {
      // Clear cancelled_date if status is not cancelled
      updateData.cancelled_date = null;
    }
    
    const { data, error } = await supabase
      .from('da6_forms')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Form not found' });
    }
    res.json({ form: data });
  } catch (error) {
    console.error('Error updating DA6 form:', error);
    res.status(500).json({ error: 'Failed to update DA6 form' });
  }
});

app.delete('/api/da6-forms/:id', verifyAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('da6_forms')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ message: 'Form deleted successfully' });
  } catch (error) {
    console.error('Error deleting DA6 form:', error);
    res.status(500).json({ error: 'Failed to delete DA6 form' });
  }
});

// Soldiers/Personnel routes
app.get('/api/soldiers', verifyAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('soldiers')
      .select('*')
      .eq('user_id', req.user.id)
      .order('last_name', { ascending: true });

    if (error) throw error;
    res.json({ soldiers: data || [] });
  } catch (error) {
    console.error('Error fetching soldiers:', error);
    res.status(500).json({ error: 'Failed to fetch soldiers' });
  }
});

app.post('/api/soldiers', verifyAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('soldiers')
      .insert({
        user_id: req.user.id,
        ...req.body
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ soldier: data });
  } catch (error) {
    console.error('Error creating soldier:', error);
    res.status(500).json({ error: 'Failed to create soldier' });
  }
});

app.put('/api/soldiers/:id', verifyAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('soldiers')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Soldier not found' });
    }
    res.json({ soldier: data });
  } catch (error) {
    console.error('Error updating soldier:', error);
    res.status(500).json({ error: 'Failed to update soldier' });
  }
});

app.delete('/api/soldiers/:id', verifyAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('soldiers')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ message: 'Soldier deleted successfully' });
  } catch (error) {
    console.error('Error deleting soldier:', error);
    res.status(500).json({ error: 'Failed to delete soldier' });
  }
});

// Soldier Appointments routes
app.get('/api/soldiers/:id/appointments', verifyAuth, async (req, res) => {
  try {
    // Verify soldier belongs to user
    const { data: soldier, error: soldierError } = await supabase
      .from('soldiers')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (soldierError || !soldier) {
      return res.status(404).json({ error: 'Soldier not found' });
    }

    const { data, error } = await supabase
      .from('soldier_appointments')
      .select('*')
      .eq('soldier_id', req.params.id)
      .eq('user_id', req.user.id)
      .order('start_date', { ascending: true });

    if (error) throw error;
    res.json({ appointments: data || [] });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

app.post('/api/soldiers/:id/appointments', verifyAuth, async (req, res) => {
  try {
    // Verify soldier belongs to user
    const { data: soldier, error: soldierError } = await supabase
      .from('soldiers')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (soldierError || !soldier) {
      return res.status(404).json({ error: 'Soldier not found' });
    }

    const { data, error } = await supabase
      .from('soldier_appointments')
      .insert({
        soldier_id: req.params.id,
        user_id: req.user.id,
        ...req.body
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ appointment: data });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

app.put('/api/soldiers/:id/appointments/:appointmentId', verifyAuth, async (req, res) => {
  try {
    // Verify soldier belongs to user
    const { data: soldier, error: soldierError } = await supabase
      .from('soldiers')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (soldierError || !soldier) {
      return res.status(404).json({ error: 'Soldier not found' });
    }

    const { data, error } = await supabase
      .from('soldier_appointments')
      .update(req.body)
      .eq('id', req.params.appointmentId)
      .eq('soldier_id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    res.json({ appointment: data });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

app.delete('/api/soldiers/:id/appointments/:appointmentId', verifyAuth, async (req, res) => {
  try {
    // Verify soldier belongs to user
    const { data: soldier, error: soldierError } = await supabase
      .from('soldiers')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (soldierError || !soldier) {
      return res.status(404).json({ error: 'Soldier not found' });
    }

    const { error } = await supabase
      .from('soldier_appointments')
      .delete()
      .eq('id', req.params.appointmentId)
      .eq('soldier_id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

// Bulk Appointments routes (for performance optimization)
// Get all appointments for a specific form
app.get('/api/appointments/by-form/:formId', verifyAuth, async (req, res) => {
  try {
    // Verify form belongs to user
    const { data: form, error: formError } = await supabase
      .from('da6_forms')
      .select('id')
      .eq('id', req.params.formId)
      .eq('user_id', req.user.id)
      .single();

    if (formError || !form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    // Get all appointments with notes containing the form ID
    const { data, error } = await supabase
      .from('soldier_appointments')
      .select('*')
      .eq('user_id', req.user.id)
      .like('notes', `%DA6_FORM:${req.params.formId}%`)
      .order('start_date', { ascending: true });

    if (error) throw error;
    res.json({ appointments: data || [] });
  } catch (error) {
    console.error('Error fetching appointments by form:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Bulk delete appointments
app.post('/api/appointments/bulk-delete', verifyAuth, async (req, res) => {
  try {
    const { appointmentIds } = req.body;
    
    if (!Array.isArray(appointmentIds) || appointmentIds.length === 0) {
      return res.status(400).json({ error: 'appointmentIds must be a non-empty array' });
    }

    // Verify all appointments belong to user and delete them
    const { error } = await supabase
      .from('soldier_appointments')
      .delete()
      .in('id', appointmentIds)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ message: `Successfully deleted ${appointmentIds.length} appointment(s)` });
  } catch (error) {
    console.error('Error bulk deleting appointments:', error);
    res.status(500).json({ error: 'Failed to delete appointments' });
  }
});

// Bulk create appointments
app.post('/api/appointments/bulk-create', verifyAuth, async (req, res) => {
  try {
    const { appointments } = req.body;
    
    if (!Array.isArray(appointments) || appointments.length === 0) {
      return res.status(400).json({ error: 'appointments must be a non-empty array' });
    }

    // Verify all soldier_ids belong to user
    const soldierIds = [...new Set(appointments.map(apt => apt.soldier_id))];
    const { data: soldiers, error: soldiersError } = await supabase
      .from('soldiers')
      .select('id')
      .in('id', soldierIds)
      .eq('user_id', req.user.id);

    if (soldiersError) throw soldiersError;
    
    const validSoldierIds = new Set(soldiers.map(s => s.id));
    const invalidAppointments = appointments.filter(apt => !validSoldierIds.has(apt.soldier_id));
    
    if (invalidAppointments.length > 0) {
      return res.status(400).json({ 
        error: 'Some appointments reference soldiers that do not belong to you' 
      });
    }

    // Add user_id to all appointments
    const appointmentsWithUserId = appointments.map(apt => ({
      ...apt,
      user_id: req.user.id
    }));

    // Insert all appointments
    const { data, error } = await supabase
      .from('soldier_appointments')
      .insert(appointmentsWithUserId)
      .select();

    if (error) throw error;
    res.status(201).json({ 
      appointments: data || [],
      message: `Successfully created ${data.length} appointment(s)` 
    });
  } catch (error) {
    console.error('Error bulk creating appointments:', error);
    res.status(500).json({ error: 'Failed to create appointments' });
  }
});

// Holidays routes
app.get('/api/holidays', verifyAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .eq('user_id', req.user.id)
      .order('date', { ascending: true });

    if (error) throw error;
    res.json({ holidays: data || [] });
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});

app.post('/api/holidays', verifyAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('holidays')
      .insert({
        user_id: req.user.id,
        ...req.body
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ holiday: data });
  } catch (error) {
    console.error('Error creating holiday:', error);
    res.status(500).json({ error: 'Failed to create holiday' });
  }
});

app.put('/api/holidays/:id', verifyAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('holidays')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Holiday not found' });
    }
    res.json({ holiday: data });
  } catch (error) {
    console.error('Error updating holiday:', error);
    res.status(500).json({ error: 'Failed to update holiday' });
  }
});

app.delete('/api/holidays/:id', verifyAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('holidays')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ message: 'Holiday deleted successfully' });
  } catch (error) {
    console.error('Error deleting holiday:', error);
    res.status(500).json({ error: 'Failed to delete holiday' });
  }
});

// DA6 form generation endpoint
app.post('/api/generate-da6', verifyAuth, async (req, res) => {
  // TODO: Implement DA6 form PDF generation logic
  res.json({ 
    message: 'DA6 form generation endpoint',
    data: req.body 
  });
});

// Recalculate days since last duty for all soldiers based on all completed rosters
app.post('/api/recalculate-days-since-duty', verifyAuth, async (req, res) => {
  try {
    // This endpoint triggers recalculation on the client side
    // The actual calculation happens client-side to reuse existing assignment generation logic
    res.json({ 
      message: 'Recalculation triggered. Client will process all completed rosters.',
      success: true
    });
  } catch (error) {
    console.error('Error triggering recalculation:', error);
    res.status(500).json({ error: 'Failed to trigger recalculation' });
  }
});

// Export app for Vercel serverless functions
module.exports = app;

// Start server only if not in Vercel environment
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
  });
}

