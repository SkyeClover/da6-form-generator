import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin } from '../utils/adminCheck';
import { getAllRanks, getRankName } from '../utils/rankOrder';
import { generateRoster } from '../utils/rosterGenerator';
import { calculateFormStatus } from '../utils/formStatus';
import { getFederalHolidaysInRange } from '../utils/federalHolidays';
import Layout from './Layout';
import LoadingScreen from './LoadingScreen';
import './DA6Form.css';

const DA6Form = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const userIsAdmin = isAdmin(user);
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    unit_name: '',
    nature_of_duty: '',
    period_start: '',
    period_end: '',
    days_off_after_duty: 1,
    separate_weekend_holiday_cycle: false,
    applies_to_weekends_holidays: true,
    rank_requirements: {
      requirements: [],
      exclusions: {
        ranks: [],
        groups: []
      }
    }
  });

  const [rankRequirement, setRankRequirement] = useState({
    quantity: 1,
    type: 'group', // 'group', 'rank_range', 'specific_ranks'
    group: 'lower_enlisted',
    rank_range_start: 'PVT',
    rank_range_end: 'SPC',
    specific_ranks: [],
    preferred_ranks: '',
    fallback_ranks: ''
  });

  const allRanks = getAllRanks();
  const rankGroups = [
    { value: 'lower_enlisted', label: 'Lower Enlisted (PVT-SPC)' },
    { value: 'nco', label: 'NCO (CPL-CSM)' },
    { value: 'warrant', label: 'Warrant Officers (WO1-CW5)' },
    { value: 'officer', label: 'Officers (2LT-GEN)' }
  ];

  useEffect(() => {
    if (isEditing) {
      fetchFormData();
    }
  }, [id]);

  const fetchFormData = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get(`/da6-forms/${id}`);
      const form = data.form;
      
      // For backward compatibility: if either weekend or holiday cycle is enabled, enable the combined one
      const separateWeekend = form.form_data?.duty_config?.separate_weekend_cycle || false;
      const separateHoliday = form.form_data?.duty_config?.separate_holiday_cycle || false;
      const separateWeekendHoliday = separateWeekend || separateHoliday;
      
      setFormData({
        unit_name: form.unit_name || '',
        nature_of_duty: form.form_data?.duty_config?.nature_of_duty || '',
        period_start: form.period_start || '',
        period_end: form.period_end || '',
        days_off_after_duty: form.form_data?.duty_config?.days_off_after_duty || 1,
        separate_weekend_holiday_cycle: separateWeekendHoliday,
        applies_to_weekends_holidays: form.form_data?.duty_config?.applies_to_weekends_holidays !== undefined 
          ? form.form_data.duty_config.applies_to_weekends_holidays 
          : true, // Default to true for backward compatibility
        rank_requirements: form.form_data?.rank_requirements || {
          requirements: [],
          exclusions: { ranks: [], groups: [] }
        }
      });
    } catch (error) {
      console.error('Error fetching form:', error);
      setError('Failed to load form data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleRankRequirementChange = (e) => {
    const { name, value, type, checked } = e.target;
    setRankRequirement(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAddRankRequirement = () => {
    if (rankRequirement.quantity < 1) {
      alert('Quantity must be at least 1');
      return;
    }

    const requirement = {
      quantity: parseInt(rankRequirement.quantity),
    };

    // Add requirement based on type
    if (rankRequirement.type === 'group') {
      requirement.group = rankRequirement.group;
    } else if (rankRequirement.type === 'rank_range') {
      requirement.rank_range = `${rankRequirement.rank_range_start}-${rankRequirement.rank_range_end}`;
    } else if (rankRequirement.type === 'specific_ranks') {
      if (rankRequirement.specific_ranks.length === 0) {
        alert('Please select at least one rank');
        return;
      }
      requirement.ranks = rankRequirement.specific_ranks;
    }

    // Add optional fields
    if (rankRequirement.preferred_ranks) {
      requirement.preferred_ranks = rankRequirement.preferred_ranks.split(',').map(r => r.trim().toUpperCase()).filter(r => r);
    }
    if (rankRequirement.fallback_ranks) {
      requirement.fallback_ranks = rankRequirement.fallback_ranks.split(',').map(r => r.trim().toUpperCase()).filter(r => r);
    }

    setFormData(prev => ({
      ...prev,
      rank_requirements: {
        ...prev.rank_requirements,
        requirements: [...prev.rank_requirements.requirements, requirement]
      }
    }));

    // Reset form
    setRankRequirement({
      quantity: 1,
      type: 'group',
      group: 'lower_enlisted',
      rank_range_start: 'PVT',
      rank_range_end: 'SPC',
      specific_ranks: [],
      preferred_ranks: '',
      fallback_ranks: ''
    });
  };

  const handleRemoveRankRequirement = (index) => {
    setFormData(prev => ({
      ...prev,
      rank_requirements: {
        ...prev.rank_requirements,
        requirements: prev.rank_requirements.requirements.filter((_, i) => i !== index)
      }
    }));
  };

  const handleToggleSpecificRank = (rankCode) => {
    setRankRequirement(prev => {
      const ranks = prev.specific_ranks || [];
      const newRanks = ranks.includes(rankCode)
        ? ranks.filter(r => r !== rankCode)
        : [...ranks, rankCode];
      return { ...prev, specific_ranks: newRanks };
    });
  };

  const handleToggleExcludedRank = (rankCode) => {
    setFormData(prev => {
      const ranks = prev.rank_requirements.exclusions.ranks || [];
      const newRanks = ranks.includes(rankCode)
        ? ranks.filter(r => r !== rankCode)
        : [...ranks, rankCode];
      return {
        ...prev,
        rank_requirements: {
          ...prev.rank_requirements,
          exclusions: {
            ...prev.rank_requirements.exclusions,
            ranks: newRanks
          }
        }
      };
    });
  };

  const handleToggleExcludedGroup = (group) => {
    setFormData(prev => {
      const groups = prev.rank_requirements.exclusions.groups || [];
      const newGroups = groups.includes(group)
        ? groups.filter(g => g !== group)
        : [...groups, group];
      return {
        ...prev,
        rank_requirements: {
          ...prev.rank_requirements,
          exclusions: {
            ...prev.rank_requirements.exclusions,
            groups: newGroups
          }
        }
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // Validation
    if (!formData.unit_name.trim()) {
      setError('Unit name is required');
      setSubmitting(false);
      return;
    }

    if (!formData.nature_of_duty.trim()) {
      setError('Name of duty is required');
      setSubmitting(false);
      return;
    }

    if (!formData.period_start || !formData.period_end) {
      setError('Start date and end date are required');
      setSubmitting(false);
      return;
    }

    const startDate = new Date(formData.period_start);
    const endDate = new Date(formData.period_end);

    if (startDate > endDate) {
      setError('Start date must be before or equal to end date');
      setSubmitting(false);
      return;
    }

    if (formData.rank_requirements.requirements.length === 0) {
      setError('At least one rank requirement is required');
      setSubmitting(false);
      return;
    }

    const daysOff = parseInt(formData.days_off_after_duty, 10);
    if (isNaN(daysOff) || daysOff < 0) {
      setError('Days off after duty must be a non-negative number');
      setSubmitting(false);
      return;
    }

    try {
      // Prepare duty config
      const dutyConfig = {
        nature_of_duty: formData.nature_of_duty.trim(),
        days_off_after_duty: daysOff,
        // Set both to the same value - weekends and holidays are treated the same
        separate_weekend_cycle: formData.separate_weekend_holiday_cycle,
        separate_holiday_cycle: formData.separate_weekend_holiday_cycle,
        applies_to_weekends_holidays: formData.applies_to_weekends_holidays
      };

      const dutyName = dutyConfig.nature_of_duty;

      // Calculate initial status based on dates
      const initialStatus = calculateFormStatus(formData.period_start, formData.period_end);

      let payload = {
        unit_name: formData.unit_name.trim(),
        period_start: formData.period_start,
        period_end: formData.period_end,
        status: initialStatus,
        form_data: {
          duty_config: dutyConfig,
          rank_requirements: formData.rank_requirements
        }
      };

      if (isEditing) {
        // When editing, always regenerate the roster to ensure it matches current rules
        // This prevents "ghost" assignments from old configurations
        console.log('Editing form - regenerating roster with current rules...');
        
        try {
          // CRITICAL: Delete old appointments FIRST before fetching data for roster generation
          // This ensures old duties/passes don't interfere with new roster generation
          try {
            const { data: oldAppointmentsData } = await apiClient.get(`/appointments/by-form/${id}`);
            const oldAppointments = oldAppointmentsData.appointments || [];
            
            if (oldAppointments.length > 0) {
              const appointmentIds = oldAppointments.map(apt => apt.id);
              const dutyAppts = oldAppointments.filter(apt => apt.exception_code === 'D');
              const passAppts = oldAppointments.filter(apt => apt.exception_code === 'P');
              const otherAppts = oldAppointments.filter(apt => apt.exception_code !== 'D' && apt.exception_code !== 'P');
              
              console.log(`[FORM EDIT] Found ${oldAppointments.length} old appointment(s) to delete:`, {
                total: oldAppointments.length,
                duty: dutyAppts.length,
                pass: passAppts.length,
                other: otherAppts.length,
                appointmentIds: appointmentIds
              });
              
              try {
                const deleteResponse = await apiClient.post('/appointments/bulk-delete', {
                  appointmentIds: appointmentIds
                });
                
                // Verify deletion was successful
                const deletedCount = deleteResponse.data?.deletedCount || 0;
                if (deletedCount !== oldAppointments.length) {
                  console.error(`[FORM EDIT] WARNING: Expected to delete ${oldAppointments.length} appointments, but only ${deletedCount} were deleted!`);
                  throw new Error(`Failed to delete all old appointments. Expected ${oldAppointments.length}, deleted ${deletedCount}`);
                }
                
                console.log(`[FORM EDIT] Successfully deleted ${deletedCount} old appointment(s) (${dutyAppts.length} duty, ${passAppts.length} pass, ${otherAppts.length} other) from form ${id}`);
                
                // Add a small delay to allow Supabase to process the deletion (helps avoid rate limits)
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Verify deletion by checking again (with retry logic for rate limits)
                let remainingAppointments = [];
                let verifyAttempts = 0;
                const maxVerifyAttempts = 3;
                
                while (verifyAttempts < maxVerifyAttempts) {
                  try {
                    const { data: verifyData } = await apiClient.get(`/appointments/by-form/${id}`);
                    remainingAppointments = verifyData?.appointments || [];
                    break; // Success, exit retry loop
                  } catch (verifyErr) {
                    verifyAttempts++;
                    const isRateLimit = verifyErr.response?.status === 429 || 
                                       verifyErr.message?.toLowerCase().includes('rate limit') ||
                                       verifyErr.message?.toLowerCase().includes('too many requests');
                    
                    if (isRateLimit && verifyAttempts < maxVerifyAttempts) {
                      // Exponential backoff: wait 1s, 2s, 4s
                      const waitTime = Math.pow(2, verifyAttempts - 1) * 1000;
                      console.warn(`[FORM EDIT] Rate limit hit during verification (attempt ${verifyAttempts}/${maxVerifyAttempts}), waiting ${waitTime}ms...`);
                      await new Promise(resolve => setTimeout(resolve, waitTime));
                    } else {
                      // Not a rate limit, or max attempts reached
                      console.warn(`[FORM EDIT] Could not verify deletion (attempt ${verifyAttempts}/${maxVerifyAttempts}):`, verifyErr);
                      if (!isRateLimit) {
                        // If it's not a rate limit, we should still check what we got
                        break;
                      }
                    }
                  }
                }
                
                if (remainingAppointments.length > 0) {
                  console.error(`[FORM EDIT] ERROR: ${remainingAppointments.length} appointment(s) still exist after deletion!`, {
                    remainingIds: remainingAppointments.map(apt => apt.id)
                  });
                  throw new Error(`Failed to delete all appointments. ${remainingAppointments.length} still remain.`);
                } else {
                  console.log(`[FORM EDIT] Verified: All old appointments successfully deleted from form ${id}`);
                }
              } catch (bulkErr) {
                console.error('[FORM EDIT] Error bulk deleting old appointments:', bulkErr);
                // Don't continue if deletion failed - this is critical
                throw new Error(`Failed to delete old appointments: ${bulkErr.message || bulkErr}`);
              }
            } else {
              console.log(`[FORM EDIT] No old appointments found for form ${id}`);
            }
          } catch (deleteErr) {
            console.error('[FORM EDIT] Critical error deleting old appointments:', deleteErr);
            // Don't continue if we can't delete old appointments - this will cause data corruption
            throw new Error(`Failed to delete old appointments before regenerating roster: ${deleteErr.message || deleteErr}`);
          }
          
          // Fetch required data for roster generation (after deleting old appointments)
          const [soldiersResponse, formsResponse] = await Promise.all([
            apiClient.get('/soldiers'),
            apiClient.get('/da6-forms')
          ]);

          const allSoldiers = soldiersResponse.data.soldiers || [];
          const allForms = formsResponse.data.forms || [];
          
          // CRITICAL: Exclude current form from otherForms to prevent old assignments from affecting calculation
          const otherForms = allForms.filter(f => f.id !== id);

          // Fetch appointments for all soldiers with batching to avoid rate limits
          // Batch size of 5 to avoid overwhelming Supabase
          const BATCH_SIZE = 5;
          const allAppointments = [];
          
          for (let i = 0; i < allSoldiers.length; i += BATCH_SIZE) {
            const batch = allSoldiers.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(soldier =>
              apiClient.get(`/soldiers/${soldier.id}/appointments`)
                .then(response => response.data.appointments || [])
                .catch(error => {
                  const isRateLimit = error.response?.status === 429 || 
                                     error.message?.toLowerCase().includes('rate limit') ||
                                     error.message?.toLowerCase().includes('too many requests');
                  
                  if (isRateLimit) {
                    console.warn(`[FORM EDIT] Rate limit hit fetching appointments for soldier ${soldier.id}, will retry...`);
                    // Retry once after a delay
                    return new Promise(resolve => {
                      setTimeout(() => {
                        apiClient.get(`/soldiers/${soldier.id}/appointments`)
                          .then(response => resolve(response.data.appointments || []))
                          .catch(() => {
                            console.error(`Error fetching appointments for soldier ${soldier.id} after retry`);
                            resolve([]);
                          });
                      }, 1000);
                    });
                  } else {
                    console.error(`Error fetching appointments for soldier ${soldier.id}:`, error);
                    return [];
                  }
                })
            );
            
            const batchResults = await Promise.all(batchPromises);
            allAppointments.push(...batchResults.flat());
            
            // Small delay between batches to avoid rate limits
            if (i + BATCH_SIZE < allSoldiers.length) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }
          
          console.log(`Fetched ${allAppointments.length} appointment(s) for roster generation (old appointments already deleted)`);

          // Generate roster for the updated period and rules
          // otherForms already excludes the current form, so old assignments won't interfere
          const rosterData = generateRoster(
            {
              duty_config: {
                ...dutyConfig,
                period_start: formData.period_start,
                period_end: formData.period_end
              },
              rank_requirements: formData.rank_requirements
            },
            allSoldiers,
            allAppointments,
            otherForms // Already filtered to exclude current form
          );

          // Replace assignments and selected_soldiers with newly generated ones
          // CRITICAL: Completely rebuild form_data to ensure old assignments are removed
          // This prevents "ghost" assignments from old period or previous roster generations
          payload.form_data = {
            ...payload.form_data, // Keep duty_config and rank_requirements
            assignments: rosterData.assignments, // Completely replace assignments array
            selected_soldiers: rosterData.selected_soldiers // Completely replace selected_soldiers array
          };
          
          // Debug logging for edit
          const editPassAssignments = rosterData.assignments.filter(a => a.exception_code === 'P');
          console.log('Roster regeneration complete (EDIT):', {
            total_assignments: rosterData.assignments.length,
            duty_assignments: rosterData.assignments.filter(a => a.duty).length,
            pass_assignments: editPassAssignments.length,
            selected_soldiers: rosterData.selected_soldiers.length
          });
          
          if (editPassAssignments.length > 0) {
            console.log('Sample pass assignments in regenerated roster:', editPassAssignments.slice(0, 5));
          }
          
          // Create new duty and pass appointments
          // (Old appointments were already deleted before roster generation)
          try {
            const daysOffAfterDuty = dutyConfig.days_off_after_duty || 1;
            const holidays = getFederalHolidaysInRange(
              new Date(formData.period_start),
              new Date(formData.period_end)
            );
            const holidayDates = new Set(holidays.map(h => h.date));
            
            const isWeekend = (date) => {
              const day = date.getDay();
              return day === 0 || day === 6;
            };
            
            const isHoliday = (dateStr) => {
              return holidayDates.has(dateStr);
            };
            
            let dutyAppointments = [];
            let passAppointments = [];
            
            rosterData.assignments.forEach(assignment => {
              if (assignment.duty === true) {
                // Create duty appointment
                dutyAppointments.push({
                  soldier_id: assignment.soldier_id,
                  start_date: assignment.date,
                  end_date: assignment.date,
                  reason: `${dutyConfig.nature_of_duty} Duty`,
                  exception_code: 'D',
                  form_id: id, // Direct UUID link to form
                  notes: `DA6_FORM:${id} - Auto-generated duty assignment`
                });
                
                // Create pass appointments
                const dutyDate = new Date(assignment.date);
                dutyDate.setHours(0, 0, 0, 0);
                
                let daysCreated = 0;
                let dayOffset = 1;
                
                while (daysCreated < daysOffAfterDuty) {
                  const passDate = new Date(dutyDate);
                  passDate.setDate(passDate.getDate() + dayOffset);
                  passDate.setHours(0, 0, 0, 0);
                  const passDateStr = passDate.toISOString().split('T')[0];
                  
                  const isWeekendDay = isWeekend(passDate);
                  const isHolidayDay = isHoliday(passDateStr);
                  
                  if (!dutyConfig.applies_to_weekends_holidays && (isWeekendDay || isHolidayDay)) {
                    dayOffset++;
                    continue;
                  }
                  
                  const existingPass = passAppointments.find(apt =>
                    apt.soldier_id === assignment.soldier_id &&
                    apt.start_date === passDateStr
                  );
                  
                  if (!existingPass) {
                  passAppointments.push({
                    soldier_id: assignment.soldier_id,
                    start_date: passDateStr,
                    end_date: passDateStr,
                    reason: `Pass (Days off after ${dutyConfig.nature_of_duty})`,
                    exception_code: 'P',
                    form_id: id, // Direct UUID link to form
                    notes: `DA6_FORM:${id} - Auto-generated pass`
                  });
                  }
                  
                  daysCreated++;
                  dayOffset++;
                }
              }
            });
            
            // Bulk create new appointments
            const allAppointmentsToCreate = [...dutyAppointments, ...passAppointments];
            if (allAppointmentsToCreate.length > 0) {
              // Debug: Log what we're creating
              const dutyWithFormId = dutyAppointments.filter(apt => apt.form_id).length;
              const dutyWithoutFormId = dutyAppointments.length - dutyWithFormId;
              const passWithFormId = passAppointments.filter(apt => apt.form_id).length;
              const passWithoutFormId = passAppointments.length - passWithFormId;
              
              console.log(`[FORM EDIT] Creating appointments:`, {
                total_duty: dutyAppointments.length,
                duty_with_form_id: dutyWithFormId,
                duty_without_form_id: dutyWithoutFormId,
                total_pass: passAppointments.length,
                pass_with_form_id: passWithFormId,
                pass_without_form_id: passWithoutFormId,
                form_id: id
              });
              
              if (dutyWithoutFormId > 0) {
                console.error(`[FORM EDIT] ERROR: ${dutyWithoutFormId} duty appointment(s) created without form_id!`);
              }
              
              await apiClient.post('/appointments/bulk-create', {
                appointments: allAppointmentsToCreate
              });
              console.log(`[FORM EDIT] Created ${dutyAppointments.length} duty appointment(s) and ${passAppointments.length} pass appointment(s)`);
            }
          } catch (apptError) {
            console.error('Error updating appointments:', apptError);
            // Continue even if appointment update fails
          }
        } catch (rosterError) {
          console.error('Error regenerating roster:', rosterError);
          
          // If deletion failed, don't try to preserve data - this is a critical error
          if (rosterError.message && rosterError.message.includes('Failed to delete old appointments')) {
            throw rosterError; // Re-throw deletion errors - don't continue
          }
          
          // If roster generation fails due to insufficient eligible soldiers, show error to user
          if (rosterError.message && (rosterError.message.includes('Not enough eligible soldiers') || rosterError.message.includes('CRITICAL ERROR'))) {
            throw new Error(`Cannot update form: ${rosterError.message}`);
          }
          
          // If roster generation fails (but deletion succeeded), try to preserve existing data
          try {
            const { data: currentFormData } = await apiClient.get(`/da6-forms/${id}`);
            const currentForm = currentFormData.form;
            if (currentForm.form_data?.assignments) {
              payload.form_data.assignments = currentForm.form_data.assignments;
            }
            if (currentForm.form_data?.selected_soldiers) {
              payload.form_data.selected_soldiers = currentForm.form_data.selected_soldiers;
            }
          } catch (fetchError) {
            console.error('Error fetching current form data as fallback:', fetchError);
          }
        }
        
        // When editing, recalculate status based on updated dates
        payload.status = calculateFormStatus(formData.period_start, formData.period_end);
        
        await apiClient.put(`/da6-forms/${id}`, payload);
        navigate(`/forms/${id}/view`);
      } else {
        // For new forms, generate the roster
        let passAppointments = [];
        let createdPassAppointments = []; // Declare in outer scope
        let shouldRecompileFuture = false; // Declare in outer scope
        let affectedFutureForms = []; // Declare in outer scope
        
        try {
          // Fetch required data for roster generation
          const [soldiersResponse, formsResponse] = await Promise.all([
            apiClient.get('/soldiers'),
            apiClient.get('/da6-forms')
          ]);

          const allSoldiers = soldiersResponse.data.soldiers || [];
          const otherForms = formsResponse.data.forms || [];
          
          // Check if this new roster would affect future rosters
          // Future rosters are those that start after this roster's end date
          const newFormEndDate = new Date(formData.period_end);
          newFormEndDate.setHours(0, 0, 0, 0);
          
          affectedFutureForms = otherForms.filter(f => {
            const futureFormStart = new Date(f.period_start);
            futureFormStart.setHours(0, 0, 0, 0);
            return futureFormStart > newFormEndDate;
          });
          
          // Ask user if they want to re-compile affected future rosters
          if (affectedFutureForms.length > 0) {
            const futureFormNames = affectedFutureForms
              .map(f => f.form_data?.duty_config?.nature_of_duty || 'Unnamed Duty')
              .join(', ');
            
            shouldRecompileFuture = window.confirm(
              `Creating this roster will affect ${affectedFutureForms.length} future roster(s): ${futureFormNames}\n\n` +
              `The days since last duty for soldiers in those rosters will change based on this new roster.\n\n` +
              `Would you like to automatically re-compile those future rosters to update their assignments?`
            );
          }

          // Fetch appointments for all soldiers in parallel
          const appointmentPromises = allSoldiers.map(soldier =>
            apiClient.get(`/soldiers/${soldier.id}/appointments`)
              .then(response => response.data.appointments || [])
              .catch(error => {
                console.error(`Error fetching appointments for soldier ${soldier.id}:`, error);
                return [];
              })
          );

          const appointmentArrays = await Promise.all(appointmentPromises);
          const allAppointments = appointmentArrays.flat();

          // Generate roster
          const rosterData = generateRoster(
            {
              duty_config: {
                ...dutyConfig,
                period_start: formData.period_start,
                period_end: formData.period_end
              },
              rank_requirements: formData.rank_requirements
            },
            allSoldiers,
            allAppointments,
            otherForms
          );

          // Add generated roster data to payload
          // CRITICAL: Completely rebuild form_data to ensure clean state
          // This ensures no "ghost" assignments from previous roster generations
          payload.form_data = {
            ...payload.form_data, // Keep duty_config and rank_requirements
            assignments: rosterData.assignments, // Completely replace assignments array
            selected_soldiers: rosterData.selected_soldiers // Completely replace selected_soldiers array
          };
          
          // Debug logging
          const passAssignments = rosterData.assignments.filter(a => a.exception_code === 'P');
          console.log('Roster generation complete (NEW FORM):', {
            total_assignments: rosterData.assignments.length,
            duty_assignments: rosterData.assignments.filter(a => a.duty).length,
            pass_assignments: passAssignments.length,
            selected_soldiers: rosterData.selected_soldiers.length
          });
          
          // Debug: Log some pass assignments to verify they're being created
          if (passAssignments.length > 0) {
            console.log('Sample pass assignments in rosterData:', passAssignments.slice(0, 5));
            console.log('Pass assignments will be saved to form_data.assignments');
          } else {
            console.warn('WARNING: No pass assignments were created in roster generator!');
          }
          
          // Verify passes are actually in the payload before saving
          const payloadPassAssignments = payload.form_data.assignments.filter(a => a.exception_code === 'P');
          if (payloadPassAssignments.length !== passAssignments.length) {
            console.error('ERROR: Pass assignments count mismatch!', {
              rosterData: passAssignments.length,
              payload: payloadPassAssignments.length
            });
          }

          // Create appointments for passes (P exception codes) in the database
          const daysOffAfterDuty = dutyConfig.days_off_after_duty || 1;
          
          // Get holidays for the form period to check if pass dates are holidays
          const holidays = getFederalHolidaysInRange(
            new Date(formData.period_start),
            new Date(formData.period_end)
          );
          const holidayDates = new Set(holidays.map(h => h.date));
          
          // Helper function to check if a date is a weekend
          const isWeekend = (date) => {
            const day = date.getDay();
            return day === 0 || day === 6; // Sunday or Saturday
          };
          
          // Helper function to check if a date is a holiday
          const isHoliday = (dateStr) => {
            return holidayDates.has(dateStr);
          };
          
          // Create duty appointments and pass appointments for soldier profiles
          // This helps with cross-roster checking and makes duties visible in soldier profiles
          let dutyAppointments = [];
          
          // Find all duty assignments and create appointments for them
          rosterData.assignments.forEach(assignment => {
            if (assignment.duty === true) {
              // Create duty appointment for this soldier
              dutyAppointments.push({
                soldier_id: assignment.soldier_id,
                start_date: assignment.date,
                end_date: assignment.date,
                reason: `${dutyName} Duty`,
                exception_code: 'D', // D for Duty
                form_id: id || null, // Direct UUID link to form (null if form not created yet)
                notes: `DA6_FORM:${id || 'NEW'} - Auto-generated duty assignment`
              });
              const dutyDate = new Date(assignment.date);
              dutyDate.setHours(0, 0, 0, 0);
              
              // Create pass appointments for each day off after duty
              // Always start from day 1 (the first day after duty) to ensure it's included
              let daysCreated = 0;
              let dayOffset = 1;
              
              // Keep creating passes until we've created the required number of days
              // Continue even if we go slightly past the form period to ensure all passes are created
              while (daysCreated < daysOffAfterDuty) {
                const passDate = new Date(dutyDate);
                passDate.setDate(passDate.getDate() + dayOffset);
                passDate.setHours(0, 0, 0, 0);
                const passDateStr = passDate.toISOString().split('T')[0];
                
                // Check if this date is a weekend or holiday
                const isWeekendDay = isWeekend(passDate);
                const isHolidayDay = isHoliday(passDateStr);
                
                // If duty doesn't apply to weekends/holidays, skip those days for passes
                if (!dutyConfig.applies_to_weekends_holidays && (isWeekendDay || isHolidayDay)) {
                  dayOffset++;
                  continue; // Skip this day, don't count it toward days off
                }
                
                // Check if we already have this pass appointment in our list
                const existingPass = passAppointments.find(apt =>
                  apt.soldier_id === assignment.soldier_id &&
                  apt.start_date === passDateStr
                );
                
                // Always create pass appointment for the first day and subsequent days after duty
                // This ensures passes are created in the database for soldier profiles
                if (!existingPass) {
                  passAppointments.push({
                    soldier_id: assignment.soldier_id,
                    start_date: passDateStr,
                    end_date: passDateStr,
                    reason: `Pass (Days off after ${dutyName})`,
                    exception_code: 'P',
                    form_id: id || null, // Direct UUID link to form (null if form not created yet)
                    notes: `DA6_FORM:${id || 'NEW'} - Auto-generated pass`
                  });
                }
                
                daysCreated++;
                dayOffset++;
              }
            }
          });

          // Bulk create duty and pass appointments
          const allAppointmentsToCreate = [...dutyAppointments, ...passAppointments];
          if (allAppointmentsToCreate.length > 0) {
            try {
              const { data: createResponse } = await apiClient.post('/appointments/bulk-create', {
                appointments: allAppointmentsToCreate
              });
              const createdAppointments = createResponse.appointments || [];
              createdPassAppointments = createdAppointments.filter(apt => apt.exception_code === 'P');
              console.log(`Created ${dutyAppointments.length} duty appointment(s) and ${createdPassAppointments.length} pass appointment(s)`);
            } catch (apptError) {
              console.error('Error creating appointments:', apptError);
              // Continue even if appointment creation fails
            }
          }
        } catch (rosterError) {
          console.error('Error generating roster:', rosterError);
          // If roster generation fails due to insufficient eligible soldiers, show error to user
          if (rosterError.message && rosterError.message.includes('Not enough eligible soldiers')) {
            throw new Error(`Cannot create form: ${rosterError.message}`);
          }
          // Continue without roster generation - user can generate it later
          console.warn('Form will be created without roster assignments. Roster can be generated later.');
        }

        const { data } = await apiClient.post('/da6-forms', payload);
        
        // If we have the form ID and created appointments, update the appointment form_id and notes
        // This is needed for appointments created with 'NEW' (before form was saved)
        if (createdPassAppointments.length > 0 && data.form) {
          try {
            // Update each appointment's form_id and notes to include the real form ID
            await Promise.all(createdPassAppointments.map(apt => 
              apiClient.put(`/soldiers/${apt.soldier_id}/appointments/${apt.id}`, {
                form_id: data.form.id, // Set the form_id UUID
                notes: `DA6_FORM:${data.form.id} - Auto-generated pass`
              }).catch(err => {
                console.error(`Error updating appointment ${apt.id}:`, err);
                return null;
              })
            ));
            console.log(`Updated ${createdPassAppointments.length} pass appointment(s) with form_id: ${data.form.id}`);
          } catch (updateError) {
            console.error('Error updating appointment form_id:', updateError);
            // Continue even if update fails - deletion will still work with the time-based matching
          }
        }
        
        // Also update duty appointments if they were created with 'NEW'
        if (data.form) {
          try {
            const { data: dutyApptsData } = await apiClient.get(`/appointments/by-form/${data.form.id}`);
            const dutyAppts = (dutyApptsData.appointments || []).filter(apt => 
              apt.exception_code === 'D' && !apt.form_id
            );
            if (dutyAppts.length > 0) {
              await Promise.all(dutyAppts.map(apt => 
                apiClient.put(`/soldiers/${apt.soldier_id}/appointments/${apt.id}`, {
                  form_id: data.form.id
                }).catch(() => null)
              ));
              console.log(`Updated ${dutyAppts.length} duty appointment(s) with form_id: ${data.form.id}`);
            }
          } catch (updateError) {
            console.error('Error updating duty appointment form_id:', updateError);
          }
        }
        
        // Re-compile affected future forms if user requested it
        if (shouldRecompileFuture && affectedFutureForms.length > 0) {
          // Fetch fresh data including the newly created form
          const [freshSoldiersResponse, freshFormsResponse] = await Promise.all([
            apiClient.get('/soldiers'),
            apiClient.get('/da6-forms')
          ]);
          
          const freshSoldiers = freshSoldiersResponse.data.soldiers || [];
          const freshAllForms = freshFormsResponse.data.forms || [];
          
          // Fetch fresh appointments
          const freshAppointmentPromises = freshSoldiers.map(soldier =>
            apiClient.get(`/soldiers/${soldier.id}/appointments`)
              .then(response => response.data.appointments || [])
              .catch(() => [])
          );
          const freshAppointmentArrays = await Promise.all(freshAppointmentPromises);
          const freshAllAppointments = freshAppointmentArrays.flat();
          
          // Re-compile each affected future form
          for (const futureForm of affectedFutureForms) {
            try {
              // Find the fresh version of this form
              const freshFutureForm = freshAllForms.find(f => f.id === futureForm.id);
              if (!freshFutureForm) continue;
              
              // Generate new roster for future form
              const futureRosterData = generateRoster(
                {
                  duty_config: {
                    ...freshFutureForm.form_data.duty_config,
                    period_start: freshFutureForm.period_start,
                    period_end: freshFutureForm.period_end
                  },
                  rank_requirements: freshFutureForm.form_data.rank_requirements
                },
                freshSoldiers,
                freshAllAppointments,
                freshAllForms.filter(f => f.id !== freshFutureForm.id)
              );
              
              // Update the future form with new roster
              await apiClient.put(`/da6-forms/${freshFutureForm.id}`, {
                form_data: {
                  ...freshFutureForm.form_data,
                  assignments: futureRosterData.assignments,
                  selected_soldiers: futureRosterData.selected_soldiers
                },
                status: calculateFormStatus(freshFutureForm.period_start, freshFutureForm.period_end)
              });
              
              // Delete old appointments and create new ones for future form
              await apiClient.delete(`/appointments/by-form/${freshFutureForm.id}`);
              
              // Create new appointments
              const futureDutyConfig = freshFutureForm.form_data.duty_config;
              const futureDaysOff = futureDutyConfig.days_off_after_duty || 1;
              const futureHolidays = getFederalHolidaysInRange(
                new Date(freshFutureForm.period_start),
                new Date(freshFutureForm.period_end)
              );
              const futureHolidayDates = new Set(futureHolidays.map(h => h.date));
              
              const isWeekend = (date) => {
                const day = date.getDay();
                return day === 0 || day === 6;
              };
              
              const isHoliday = (dateStr) => {
                return futureHolidayDates.has(dateStr);
              };
              
              let futureDutyAppointments = [];
              let futurePassAppointments = [];
              
              futureRosterData.assignments.forEach(assignment => {
                if (assignment.duty === true) {
                  futureDutyAppointments.push({
                    soldier_id: assignment.soldier_id,
                    start_date: assignment.date,
                    end_date: assignment.date,
                    reason: `${futureDutyConfig.nature_of_duty} Duty`,
                    exception_code: 'D',
                    form_id: freshFutureForm.id, // Direct UUID link to form
                    notes: `DA6_FORM:${freshFutureForm.id} - Auto-generated duty assignment`
                  });
                  
                  const dutyDate = new Date(assignment.date);
                  dutyDate.setHours(0, 0, 0, 0);
                  
                  let daysCreated = 0;
                  let dayOffset = 1;
                  
                  while (daysCreated < futureDaysOff) {
                    const passDate = new Date(dutyDate);
                    passDate.setDate(passDate.getDate() + dayOffset);
                    passDate.setHours(0, 0, 0, 0);
                    const passDateStr = passDate.toISOString().split('T')[0];
                    
                    const isWeekendDay = isWeekend(passDate);
                    const isHolidayDay = isHoliday(passDateStr);
                    
                    if (!futureDutyConfig.applies_to_weekends_holidays && (isWeekendDay || isHolidayDay)) {
                      dayOffset++;
                      continue;
                    }
                    
                    const existingPass = futurePassAppointments.find(apt =>
                      apt.soldier_id === assignment.soldier_id &&
                      apt.start_date === passDateStr
                    );
                    
                    if (!existingPass) {
                      futurePassAppointments.push({
                        soldier_id: assignment.soldier_id,
                        start_date: passDateStr,
                        end_date: passDateStr,
                        reason: `Pass (Days off after ${futureDutyConfig.nature_of_duty})`,
                        exception_code: 'P',
                        form_id: freshFutureForm.id, // Direct UUID link to form
                        notes: `DA6_FORM:${freshFutureForm.id} - Auto-generated pass`
                      });
                    }
                    
                    daysCreated++;
                    dayOffset++;
                  }
                }
              });
              
              const allFutureAppointments = [...futureDutyAppointments, ...futurePassAppointments];
              if (allFutureAppointments.length > 0) {
                await apiClient.post('/appointments/bulk-create', {
                  appointments: allFutureAppointments
                });
              }
              
              console.log(`Re-compiled future form: ${freshFutureForm.id}`);
            } catch (recompileError) {
              console.error(`Error re-compiling future form ${futureForm.id}:`, recompileError);
              // Continue with other forms even if one fails
            }
          }
        }
        
        navigate(`/forms/${data.form.id}/view`);
      }
    } catch (error) {
      console.error('Error saving form:', error);
      const errorMessage = error.response?.data?.error || 'Failed to save form. Please try again.';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading form..." />;
  }

  if (submitting) {
    return <LoadingScreen message={isEditing ? "Updating form..." : "Creating form..."} />;
  }

  return (
    <Layout>
      <div className="da6-form-container">
        <div className="form-header">
          <h2>{isEditing ? 'Edit DA6 Form' : 'Create New DA6 Form'}</h2>
          <button 
            className="btn-secondary"
            onClick={() => navigate('/forms')}
          >
            Cancel
          </button>
        </div>

        {error && (
          <div className="error-message" style={{
            padding: '1rem',
            marginBottom: '1rem',
            backgroundColor: '#ffebee',
            color: '#c62828',
            borderRadius: '4px',
            border: '1px solid #ef5350'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-content">
          {/* Basic Information Section */}
          <div className="form-section">
            <h3>Basic Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="unit_name">Unit Name *</label>
                <input
                  type="text"
                  id="unit_name"
                  name="unit_name"
                  value={formData.unit_name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Alpha Company, 1st Battalion"
                />
              </div>
              <div className="form-group">
                <label htmlFor="nature_of_duty">Name of Duty *</label>
                <input
                  type="text"
                  id="nature_of_duty"
                  name="nature_of_duty"
                  value={formData.nature_of_duty}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., CQ, Staff Duty, CORP"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="period_start">Start Date *</label>
                <input
                  type="date"
                  id="period_start"
                  name="period_start"
                  value={formData.period_start}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="period_end">End Date *</label>
                <input
                  type="date"
                  id="period_end"
                  name="period_end"
                  value={formData.period_end}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="days_off_after_duty">Days Off After Duty *</label>
                <input
                  type="number"
                  id="days_off_after_duty"
                  name="days_off_after_duty"
                  min="0"
                  value={formData.days_off_after_duty}
                  onChange={handleInputChange}
                  required
                />
                <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
                  Number of days off a soldier gets after completing this duty
                </small>
              </div>
            </div>
          </div>

          {/* Weekend/Holiday Options */}
          <div className="form-section">
            <h3>Weekend & Holiday Options</h3>
            <p className="section-description">
              Configure how this duty handles weekends and holidays.
            </p>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="applies_to_weekends_holidays"
                  checked={formData.applies_to_weekends_holidays}
                  onChange={handleInputChange}
                />
                <span>Duty Applies to Weekends & Holidays</span>
              </label>
              <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
                When checked, soldiers can be assigned duty on weekends (Saturday/Sunday) and federal holidays. 
                When unchecked, duty will only be assigned on weekdays, and passes will not be created for weekends/holidays.
              </small>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="separate_weekend_holiday_cycle"
                  checked={formData.separate_weekend_holiday_cycle}
                  onChange={handleInputChange}
                  disabled={!formData.applies_to_weekends_holidays}
                />
                <span>Separate Weekend/Holiday Cycle</span>
              </label>
              <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
                Enable separate cycles to prevent soldiers from getting weekends/holidays month after month.
                When enabled, weekends and holidays are tracked together, separately from regular weekdays.
                {!formData.applies_to_weekends_holidays && (
                  <span style={{ color: '#999', display: 'block', marginTop: '0.25rem' }}>
                    (Disabled when duty doesn't apply to weekends/holidays)
                  </span>
                )}
              </small>
            </div>
          </div>

          {/* Rank Requirements Section */}
          <div className="form-section">
            <h3>Rank Requirements</h3>
            <p className="section-description">
              Define how many soldiers of each rank or rank group are needed per day.
            </p>

            {/* Existing Requirements */}
            {formData.rank_requirements.requirements.length > 0 && (
              <div className="rank-requirements-list">
                <h5>Current Requirements</h5>
                {formData.rank_requirements.requirements.map((req, index) => (
                  <div key={index} className="rank-requirement-item">
                    <div className="requirement-main">
                      <strong>Quantity: {req.quantity}</strong>
                      {req.group && <span>Group: {rankGroups.find(g => g.value === req.group)?.label || req.group}</span>}
                      {req.rank_range && <span>Range: {req.rank_range}</span>}
                      {req.ranks && <span>Ranks: {req.ranks.join(', ')}</span>}
                      {req.preferred_ranks && req.preferred_ranks.length > 0 && (
                        <span>Preferred: {req.preferred_ranks.join(', ')}</span>
                      )}
                      {req.fallback_ranks && req.fallback_ranks.length > 0 && (
                        <span>Fallback: {req.fallback_ranks.join(', ')}</span>
                      )}
                      <button
                        type="button"
                        className="btn-delete-small"
                        onClick={() => handleRemoveRankRequirement(index)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Requirement */}
            <div className="form-section-subsection">
              <h4>Add Rank Requirement</h4>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="requirement_quantity">Quantity *</label>
                  <input
                    type="number"
                    id="requirement_quantity"
                    name="quantity"
                    min="1"
                    value={rankRequirement.quantity}
                    onChange={handleRankRequirementChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="requirement_type">Requirement Type *</label>
                  <select
                    id="requirement_type"
                    name="type"
                    value={rankRequirement.type}
                    onChange={handleRankRequirementChange}
                    required
                  >
                    <option value="group">Rank Group</option>
                    <option value="rank_range">Rank Range</option>
                    <option value="specific_ranks">Specific Ranks</option>
                  </select>
                </div>
              </div>

              {/* Group Selection */}
              {rankRequirement.type === 'group' && (
                <div className="form-group">
                  <label htmlFor="requirement_group">Rank Group *</label>
                  <select
                    id="requirement_group"
                    name="group"
                    value={rankRequirement.group}
                    onChange={handleRankRequirementChange}
                    required
                  >
                    {rankGroups.map(group => (
                      <option key={group.value} value={group.value}>
                        {group.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Rank Range Selection */}
              {rankRequirement.type === 'rank_range' && (
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="rank_range_start">Start Rank *</label>
                    <select
                      id="rank_range_start"
                      name="rank_range_start"
                      value={rankRequirement.rank_range_start}
                      onChange={handleRankRequirementChange}
                      required
                    >
                      {Object.values(allRanks).flat().map(rank => (
                        <option key={rank.code} value={rank.code}>
                          {rank.code} - {rank.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="rank_range_end">End Rank *</label>
                    <select
                      id="rank_range_end"
                      name="rank_range_end"
                      value={rankRequirement.rank_range_end}
                      onChange={handleRankRequirementChange}
                      required
                    >
                      {Object.values(allRanks).flat().map(rank => (
                        <option key={rank.code} value={rank.code}>
                          {rank.code} - {rank.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Specific Ranks Selection */}
              {rankRequirement.type === 'specific_ranks' && (
                <div className="form-group">
                  <label>Select Ranks *</label>
      <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: '0.5rem',
                    padding: '1rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    {Object.values(allRanks).flat().map(rank => (
                      <label
                        key={rank.code}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                      >
                        <input
                          type="checkbox"
                          checked={rankRequirement.specific_ranks.includes(rank.code)}
                          onChange={() => handleToggleSpecificRank(rank.code)}
                        />
                        <span>{rank.code} - {rank.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Optional: Preferred and Fallback Ranks */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="preferred_ranks">Preferred Ranks (optional, comma-separated)</label>
                  <input
                    type="text"
                    id="preferred_ranks"
                    name="preferred_ranks"
                    value={rankRequirement.preferred_ranks}
                    onChange={handleRankRequirementChange}
                    placeholder="e.g., SSG, SGT"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="fallback_ranks">Fallback Ranks (optional, comma-separated)</label>
                  <input
                    type="text"
                    id="fallback_ranks"
                    name="fallback_ranks"
                    value={rankRequirement.fallback_ranks}
                    onChange={handleRankRequirementChange}
                    placeholder="e.g., SGT, CPL"
                  />
                </div>
              </div>

              <button
                type="button"
                className="btn-primary"
                onClick={handleAddRankRequirement}
                style={{ marginTop: '1rem' }}
              >
                Add Requirement
              </button>
            </div>

            {/* Global Exclusions */}
            <div className="rank-exclusions">
              <h5>Global Rank Exclusions</h5>
              <p className="section-description">
                Ranks or groups that should never be assigned to this duty.
              </p>
              
              <div className="exclusions-section">
                <div className="exclusion-groups">
                  <label>Exclude Groups:</label>
                  {rankGroups.map(group => (
                    <label key={group.value} className="exclusion-checkbox">
                      <input
                        type="checkbox"
                        checked={formData.rank_requirements.exclusions.groups.includes(group.value)}
                        onChange={() => handleToggleExcludedGroup(group.value)}
                      />
                      <span>{group.label}</span>
                    </label>
                  ))}
                </div>

                <div className="exclusion-ranks">
                  <label>Exclude Specific Ranks (comma-separated):</label>
                  <input
                    type="text"
                    className="excluded-ranks-input"
                    value={formData.rank_requirements.exclusions.ranks.join(', ')}
                    onChange={(e) => {
                      const ranks = e.target.value.split(',').map(r => r.trim().toUpperCase()).filter(r => r);
                      setFormData(prev => ({
                        ...prev,
                        rank_requirements: {
                          ...prev.rank_requirements,
                          exclusions: {
                            ...prev.rank_requirements.exclusions,
                            ranks
                          }
                        }
                      }));
                    }}
                    placeholder="e.g., CSM, SGM, GEN"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions-header" style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '2px solid #eee' }}>
        <button 
              type="submit"
          className="btn-primary"
              disabled={submitting}
            >
              {isEditing ? 'Update Form' : 'Create Form'}
            </button>
            <button
              type="button"
              className="btn-secondary"
          onClick={() => navigate('/forms')}
              disabled={submitting}
        >
              Cancel
        </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default DA6Form;
