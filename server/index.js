const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { verifyAuth } = require('./middleware/auth');
const supabase = require('./config/supabase');

const app = express();
const PORT = process.env.PORT || 5000;

// Admin email and UID that bypasses limits
const ADMIN_EMAIL = 'jacobwalker852@gmail.com';
const ADMIN_UID = '5834513e-2e93-44b9-b0a1-41c383009b55';

// Helper function to check if user should have limits applied
const shouldApplyLimits = (userEmail, userId) => {
  // Check by user ID first (most reliable)
  if (userId === ADMIN_UID) {
    return false; // Admin, no limits
  }
  
  // Check by email (case-insensitive)
  if (userEmail && userEmail.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim()) {
    return false; // Admin, no limits
  }
  
  return true; // Apply limits
};

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
    // Check form limit for non-admin users
    if (shouldApplyLimits(req.user.email, req.user.id)) {
      const { count, error: countError } = await supabase
        .from('da6_forms')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user.id);

      if (countError) throw countError;
      
      if (count >= 3) {
        return res.status(403).json({ 
          error: 'Form limit reached. You can create up to 3 forms. Please delete an existing form to create a new one.' 
        });
      }
    }

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
    const { data, error } = await supabase
      .from('da6_forms')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select();

    if (error) throw error;
    
    // Ensure we always send JSON
    if (!res.headersSent) {
      res.json({ message: 'Form deleted successfully' });
    }
  } catch (error) {
    console.error('Error deleting DA6 form:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    
    // Ensure we always send JSON, even on error
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to delete DA6 form',
        message: error.message || 'Unknown error'
      });
    }
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
    // Check soldier limit for non-admin users
    if (shouldApplyLimits(req.user.email, req.user.id)) {
      const { count, error: countError } = await supabase
        .from('soldiers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user.id);

      if (countError) throw countError;
      
      if (count >= 10) {
        return res.status(403).json({ 
          error: 'Soldier limit reached. You can add up to 10 soldiers. Please delete an existing soldier to add a new one.' 
        });
      }
    }

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

// Bulk delete soldiers
app.post('/api/soldiers/bulk-delete', verifyAuth, async (req, res) => {
  try {
    const { soldierIds } = req.body;
    
    if (!Array.isArray(soldierIds) || soldierIds.length === 0) {
      return res.status(400).json({ error: 'soldierIds must be a non-empty array' });
    }

    // Verify all soldiers belong to user and delete them
    const { error } = await supabase
      .from('soldiers')
      .delete()
      .in('id', soldierIds)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ message: `Successfully deleted ${soldierIds.length} soldier(s)` });
  } catch (error) {
    console.error('Error bulk deleting soldiers:', error);
    res.status(500).json({ error: 'Failed to delete soldiers' });
  }
});

// Bulk update days since last duty
app.post('/api/soldiers/bulk-update-days', verifyAuth, async (req, res) => {
  try {
    const { updates } = req.body;
    
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'updates must be an object mapping soldier IDs to days' });
    }

    const soldierIds = Object.keys(updates);
    if (soldierIds.length === 0) {
      return res.status(400).json({ error: 'No soldiers to update' });
    }

    // Verify all soldiers belong to user
    const { data: soldiers, error: soldiersError } = await supabase
      .from('soldiers')
      .select('id')
      .in('id', soldierIds)
      .eq('user_id', req.user.id);

    if (soldiersError) throw soldiersError;
    
    const validSoldierIds = new Set(soldiers.map(s => s.id));
    const invalidIds = soldierIds.filter(id => !validSoldierIds.has(id));
    
    if (invalidIds.length > 0) {
      return res.status(400).json({ 
        error: 'Some soldiers do not belong to you' 
      });
    }

    // Update each soldier
    const updatePromises = soldierIds.map(soldierId => {
      const days = parseInt(updates[soldierId]);
      if (isNaN(days)) {
        return Promise.resolve();
      }
      return supabase
        .from('soldiers')
        .update({ days_since_last_duty: days })
        .eq('id', soldierId)
        .eq('user_id', req.user.id);
    });

    await Promise.all(updatePromises);
    res.json({ message: `Successfully updated ${soldierIds.length} soldier(s)` });
  } catch (error) {
    console.error('Error bulk updating days:', error);
    res.status(500).json({ error: 'Failed to update soldiers' });
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
      .select('id, period_start, period_end, created_at')
      .eq('id', req.params.formId)
      .eq('user_id', req.user.id)
      .single();

    if (formError) {
      console.error('Error fetching form:', formError);
      return res.status(500).json({ error: 'Failed to fetch form', details: formError.message });
    }
    
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    // PRIMARY METHOD: Get all appointments with form_id matching the form UUID
    // This is the most reliable method using direct foreign key relationship
    const { data: appointmentsByFormId, error: error1 } = await supabase
      .from('soldier_appointments')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('form_id', req.params.formId)
      .order('start_date', { ascending: true });

    if (error1) throw error1;

    // FALLBACK METHOD: Also check notes field for backward compatibility
    // This catches appointments created before form_id column was added or if form_id wasn't set
    // Note: We check notes for ALL appointments (not just form_id IS NULL) to be thorough
    // The deduplication step will remove any duplicates from the PRIMARY METHOD
    const { data: appointmentsByNotes, error: error2 } = await supabase
      .from('soldier_appointments')
      .select('*')
      .eq('user_id', req.user.id)
      .like('notes', `%DA6_FORM:${req.params.formId}%`)
      .order('start_date', { ascending: true });

    if (error2) throw error2;

    // FALLBACK METHOD 2: Check for DA6_FORM:NEW appointments created around the same time
    // (within 5 minutes of form creation) to catch appointments created before form ID was available
    const formCreatedAt = new Date(form.created_at);
    const fiveMinutesLater = new Date(formCreatedAt.getTime() + 5 * 60 * 1000);
    
    const { data: appointmentsWithNew, error: error3 } = await supabase
      .from('soldier_appointments')
      .select('*')
      .eq('user_id', req.user.id)
      .is('form_id', null) // Only check notes if form_id is null
      .like('notes', '%DA6_FORM:NEW%')
      .in('exception_code', ['P', 'D']) // Both pass and duty appointments can be auto-generated
      .gte('created_at', formCreatedAt.toISOString())
      .lte('created_at', fiveMinutesLater.toISOString())
      .order('start_date', { ascending: true });

    if (error3) throw error3;
    
    // FALLBACK METHOD 2B: Also check for appointments with DA6_FORM:NEW in notes that fall within the form's date range
    // This catches appointments that might have been created but the form_id was never set
    // This is more aggressive but necessary to catch old appointments
    let appointmentsWithNewInDateRange = [];
    if (form.period_start && form.period_end) {
      try {
        const { data: newDateRangeAppts, error: error3b } = await supabase
          .from('soldier_appointments')
          .select('*')
          .eq('user_id', req.user.id)
          .is('form_id', null)
          .like('notes', '%DA6_FORM:NEW%')
          .in('exception_code', ['P', 'D'])
          .gte('start_date', form.period_start)
          .lte('start_date', form.period_end)
          .order('start_date', { ascending: true });
        
        if (!error3b && newDateRangeAppts) {
          appointmentsWithNewInDateRange = newDateRangeAppts;
          if (appointmentsWithNewInDateRange.length > 0) {
            console.log(`[FALLBACK 2B] Found ${appointmentsWithNewInDateRange.length} DA6_FORM:NEW appointment(s) in date range`);
          }
        }
      } catch (error3b) {
        console.warn('Error in fallback 2B query:', error3b);
      }
    }
    
    // Combine initial results to check if we need fallback 3
    const initialAppointments = [
      ...(appointmentsByFormId || []), 
      ...(appointmentsByNotes || []), 
      ...(appointmentsWithNew || []),
      ...(appointmentsWithNewInDateRange || [])
    ];
    const initialUnique = Array.from(
      new Map(initialAppointments.map(apt => [apt.id, apt])).values()
    );
    
    // FALLBACK METHOD 3: Also check for appointments within the form's date range that might be related
    // This catches appointments that might have been created but not properly linked
    // Only check if we haven't found many appointments yet (to avoid false positives)
    let appointmentsByDateRange = [];
    if (initialUnique.length < 10 && form.period_start && form.period_end) {
      try {
        // Use separate queries for null and matching form_id to avoid .or() syntax issues
        const { data: dateRangeApptsNull, error: error4a } = await supabase
          .from('soldier_appointments')
          .select('*')
          .eq('user_id', req.user.id)
          .in('exception_code', ['P', 'D'])
          .gte('start_date', form.period_start)
          .lte('start_date', form.period_end)
          .is('form_id', null)
          .order('start_date', { ascending: true });
        
        const { data: dateRangeApptsMatching, error: error4b } = await supabase
          .from('soldier_appointments')
          .select('*')
          .eq('user_id', req.user.id)
          .in('exception_code', ['P', 'D'])
          .gte('start_date', form.period_start)
          .lte('start_date', form.period_end)
          .eq('form_id', req.params.formId)
          .order('start_date', { ascending: true });
        
        if (!error4a && !error4b) {
          const combined = [
            ...(dateRangeApptsNull || []),
            ...(dateRangeApptsMatching || [])
          ];
          
          // Filter to only include appointments that might be related (have DA6_FORM in notes or no form_id)
          appointmentsByDateRange = combined.filter(apt => 
            !apt.form_id || 
            apt.form_id === req.params.formId ||
            (apt.notes && apt.notes.includes('DA6_FORM'))
          );
          
          if (appointmentsByDateRange.length > 0) {
            console.log(`[FALLBACK 3] Found ${appointmentsByDateRange.length} appointment(s) in date range that might be related`);
          }
        } else {
          if (error4a) console.warn('Error in fallback 3a query (null form_id):', error4a);
          if (error4b) console.warn('Error in fallback 3b query (matching form_id):', error4b);
        }
      } catch (error4) {
        // Ignore errors in fallback method
        console.warn('Error in fallback date range query:', error4);
      }
    }

    // Combine and deduplicate by appointment ID
    const allAppointments = [
      ...(appointmentsByFormId || []), 
      ...(appointmentsByNotes || []), 
      ...(appointmentsWithNew || []),
      ...(appointmentsWithNewInDateRange || []),
      ...(appointmentsByDateRange || [])
    ];
    const uniqueAppointments = Array.from(
      new Map(allAppointments.map(apt => [apt.id, apt])).values()
    );

    // Debug: Log breakdown by exception code
    const dutyAppts = uniqueAppointments.filter(apt => apt.exception_code === 'D');
    const passAppts = uniqueAppointments.filter(apt => apt.exception_code === 'P');
    const otherAppts = uniqueAppointments.filter(apt => apt.exception_code !== 'D' && apt.exception_code !== 'P');
    
    // Debug: Log breakdown by how they were found
    const dutyByFormId = appointmentsByFormId?.filter(apt => apt.exception_code === 'D').length || 0;
    const dutyByNotes = appointmentsByNotes?.filter(apt => apt.exception_code === 'D').length || 0;
    const dutyByNew = appointmentsWithNew?.filter(apt => apt.exception_code === 'D').length || 0;
    const passByFormId = appointmentsByFormId?.filter(apt => apt.exception_code === 'P').length || 0;
    const passByNotes = appointmentsByNotes?.filter(apt => apt.exception_code === 'P').length || 0;
    const passByNew = appointmentsWithNew?.filter(apt => apt.exception_code === 'P').length || 0;
    
    console.log(`Found ${uniqueAppointments.length} appointment(s) for form ${req.params.formId}:`, {
      total: uniqueAppointments.length,
      by_form_id: appointmentsByFormId?.length || 0,
      by_notes: appointmentsByNotes?.length || 0,
      by_new_notes: appointmentsWithNew?.length || 0,
      by_new_in_date_range: appointmentsWithNewInDateRange?.length || 0,
      by_date_range: appointmentsByDateRange?.length || 0,
      duty_appointments: dutyAppts.length,
      duty_by_form_id: dutyByFormId,
      duty_by_notes: dutyByNotes,
      duty_by_new: dutyByNew,
      pass_appointments: passAppts.length,
      pass_by_form_id: passByFormId,
      pass_by_notes: passByNotes,
      pass_by_new: passByNew,
      other_appointments: otherAppts.length
    });
    
    // If we found duty appointments, log some details
    if (dutyAppts.length > 0) {
      console.log(`Sample duty appointments found:`, dutyAppts.slice(0, 3).map(apt => ({
        id: apt.id,
        form_id: apt.form_id,
        notes: apt.notes,
        start_date: apt.start_date,
        exception_code: apt.exception_code
      })));
    } else {
      console.warn(`⚠️ WARNING: No duty appointments found for form ${req.params.formId}!`);
      // Try to find any duty appointments that might be related
      try {
        const { data: allDutyAppts, error: dutyErr } = await supabase
          .from('soldier_appointments')
          .select('id, form_id, notes, start_date, exception_code, created_at')
          .eq('user_id', req.user.id)
          .eq('exception_code', 'D')
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (!dutyErr && allDutyAppts && allDutyAppts.length > 0) {
          console.log(`Recent duty appointments in system (for debugging):`, allDutyAppts.map(apt => ({
            id: apt.id,
            form_id: apt.form_id,
            notes: apt.notes?.substring(0, 50),
            start_date: apt.start_date,
            created_at: apt.created_at
          })));
        }
      } catch (debugErr) {
        console.warn('Error in debug query for duty appointments:', debugErr);
      }
    }

    res.json({ appointments: uniqueAppointments });
  } catch (error) {
    console.error('Error fetching appointments by form:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      stack: error.stack
    });
    
    // Ensure we always send JSON, even on error
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to fetch appointments',
        message: error.message || 'Unknown error'
      });
    }
  }
});

// Bulk delete appointments
app.post('/api/appointments/bulk-delete', verifyAuth, async (req, res) => {
  try {
    const { appointmentIds } = req.body;
    
    if (!Array.isArray(appointmentIds) || appointmentIds.length === 0) {
      return res.status(400).json({ error: 'appointmentIds must be a non-empty array' });
    }

    // First, fetch the appointments to verify they exist and belong to the user
    const { data: appointmentsToDelete, error: fetchError } = await supabase
      .from('soldier_appointments')
      .select('id, soldier_id, start_date, end_date, exception_code, form_id, notes')
      .in('id', appointmentIds)
      .eq('user_id', req.user.id);

    if (fetchError) throw fetchError;

    if (!appointmentsToDelete || appointmentsToDelete.length === 0) {
      return res.json({ 
        message: 'No appointments found to delete',
        deletedCount: 0,
        deletedAppointments: []
      });
    }

    // Log what we're about to delete
    const dutyCount = appointmentsToDelete.filter(apt => apt.exception_code === 'D').length;
    const passCount = appointmentsToDelete.filter(apt => apt.exception_code === 'P').length;
    const otherCount = appointmentsToDelete.length - dutyCount - passCount;
    
    console.log(`[BULK DELETE] Deleting ${appointmentsToDelete.length} appointment(s):`, {
      total: appointmentsToDelete.length,
      duty: dutyCount,
      pass: passCount,
      other: otherCount,
      appointmentIds: appointmentIds
    });

    // Delete the appointments (with retry logic for rate limits)
    let deleteError = null;
    let deleteAttempts = 0;
    const maxDeleteAttempts = 3;
    
    while (deleteAttempts < maxDeleteAttempts) {
      const { error: err } = await supabase
        .from('soldier_appointments')
        .delete()
        .in('id', appointmentIds)
        .eq('user_id', req.user.id);
      
      if (!err) {
        deleteError = null;
        break; // Success
      }
      
      deleteAttempts++;
      const isRateLimit = err.message?.toLowerCase().includes('rate limit') ||
                         err.message?.toLowerCase().includes('too many requests') ||
                         err.code === 'PGRST116' || // PostgREST rate limit error code
                         err.code === '429';
      
      if (isRateLimit && deleteAttempts < maxDeleteAttempts) {
        // Exponential backoff: wait 1s, 2s, 4s
        const waitTime = Math.pow(2, deleteAttempts - 1) * 1000;
        console.warn(`[BULK DELETE] Rate limit hit (attempt ${deleteAttempts}/${maxDeleteAttempts}), waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        deleteError = err; // Will retry
      } else {
        deleteError = err;
        break; // Not a rate limit or max attempts reached
      }
    }
    
    if (deleteError) {
      console.error('[BULK DELETE] Failed to delete appointments after retries:', deleteError);
      throw deleteError;
    }

    // Add a small delay to allow Supabase to process the deletion (helps avoid rate limits)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify deletion by trying to fetch them again (with retry logic for rate limits)
    let remainingAppointments = [];
    let verifyAttempts = 0;
    const maxVerifyAttempts = 3;
    
    while (verifyAttempts < maxVerifyAttempts) {
      const { data: remaining, error: verifyError } = await supabase
        .from('soldier_appointments')
        .select('id')
        .in('id', appointmentIds)
        .eq('user_id', req.user.id);
      
      if (!verifyError) {
        remainingAppointments = remaining || [];
        break; // Success, exit retry loop
      }
      
      verifyAttempts++;
      const isRateLimit = verifyError.message?.toLowerCase().includes('rate limit') ||
                         verifyError.message?.toLowerCase().includes('too many requests') ||
                         verifyError.code === 'PGRST116' ||
                         verifyError.code === '429';
      
      if (isRateLimit && verifyAttempts < maxVerifyAttempts) {
        // Exponential backoff: wait 1s, 2s, 4s
        const waitTime = Math.pow(2, verifyAttempts - 1) * 1000;
        console.warn(`[BULK DELETE] Rate limit hit during verification (attempt ${verifyAttempts}/${maxVerifyAttempts}), waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        // Not a rate limit, or max attempts reached
        console.warn(`[BULK DELETE] Could not verify deletion (attempt ${verifyAttempts}/${maxVerifyAttempts}):`, verifyError);
        if (!isRateLimit) {
          // If it's not a rate limit, we should still check what we got
          remainingAppointments = remaining || [];
          break;
        }
      }
    }
    
    if (remainingAppointments && remainingAppointments.length > 0) {
      console.error(`[BULK DELETE] WARNING: ${remainingAppointments.length} appointment(s) were not deleted!`, {
        remainingIds: remainingAppointments.map(apt => apt.id)
      });
      return res.status(500).json({ 
        error: `Failed to delete all appointments. ${remainingAppointments.length} appointment(s) still exist.`,
        deletedCount: appointmentsToDelete.length - remainingAppointments.length,
        failedIds: remainingAppointments.map(apt => apt.id)
      });
    }

    console.log(`[BULK DELETE] Successfully deleted ${appointmentsToDelete.length} appointment(s)`);
    
    res.json({ 
      message: `Successfully deleted ${appointmentsToDelete.length} appointment(s)`,
      deletedCount: appointmentsToDelete.length,
      deletedAppointments: appointmentsToDelete
    });
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

