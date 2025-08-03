// =======================================================
// ===   بداية الكود الكامل والنهائي لملف coverage.js    ===
// =======================================================

function formatTimeAMPM(timeString) {
    if (!timeString) return 'غير محدد';
    const [hours, minutes] = timeString.split(':');
    let h = parseInt(hours); const ampm = h >= 12 ? 'م' : 'ص'; h = h % 12; h = h ? h : 12;
    const m = minutes.padStart(2, '0');
    return `${h}:${m} ${ampm}`;
}

const supabaseClient = supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

async function fetchAndDisplayOpenShifts() {
    const container = document.getElementById('public-coverage-list');
    container.innerHTML = '<p style="text-align: center;">جاري تحميل فرص التغطية...</p>';
    const { data, error } = await supabaseClient.from('coverage_shifts').select('*').eq('status', 'open').order('created_at', { ascending: false });
    if (error || !data || data.length === 0) {
        container.innerHTML = '<p class="no-shifts">لا توجد فرص تغطية متاحة حالياً.</p>'; return;
    }
    container.innerHTML = '';
    data.forEach(shift => {
        // --- بداية الإضافة: تنظيف اسم المشروع ---
        let projectName = shift.project;
        try {
            // التحقق إذا كان النص يبدأ وينتهي بأقواس القائمة
            if (typeof projectName === 'string' && projectName.startsWith('[') && projectName.endsWith(']')) {
                const parsed = JSON.parse(projectName);
                // إذا كانت النتيجة قائمة، ندمج عناصرها
                if (Array.isArray(parsed)) {
                    projectName = parsed.join(', ');
                }
            }
        } catch (e) {
            // في حال فشل التحليل، نستخدم الاسم الأصلي كما هو
            console.error("Could not parse project name, using original value:", shift.project);
        }
        // --- نهاية الإضافة ---

        const displayLocation = `${shift.city || ''} - ${shift.location || ''}`;
        const displayTime = `من ${formatTimeAMPM(shift.start_time)} إلى ${formatTimeAMPM(shift.end_time)}`;
        container.insertAdjacentHTML('beforeend', `<div class="contract-card"><div class="contract-card-header"><h4>${projectName}</h4></div><div class="contract-card-body"><p><i class="ph-bold ph-map-pin"></i> <strong>الموقع:</strong> ${displayLocation}</p><p><i class="ph-bold ph-clock"></i> <strong>الوقت:</strong> ${displayTime}</p><p><i class="ph-bold ph-money"></i> <strong>قيمة التغطية:</strong> ${shift.coverage_pay} ر.س</p></div><div class="contract-card-footer"><button class="btn btn-primary apply-now-btn" data-shift-id="${shift.id}"><i class="ph-bold ph-paper-plane-tilt"></i> قدم الآن</button></div></div>`);
    });
}

// بداية الكود الجديد والمُصحح
async function fetchAndDisplayOpenJobs() {
    const container = document.getElementById('public-jobs-list');
    container.innerHTML = '<p style="text-align: center;">جاري تحميل الوظائف...</p>';
    
    // -- بداية التعديل: إضافة work_hours و work_days_count --
    const { data: jobs, error } = await supabaseClient
        .from('job_vacancies')
        .select('id, title, city, location, specific_location, project, base_salary, housing_allowance, transport_allowance, other_allowances, work_hours, work_days_count')
        .eq('status', 'open')
        .order('created_at', { ascending: false });
    // -- نهاية التعديل --

    if (error || !jobs || jobs.length === 0) {
        container.innerHTML = '<p class="no-shifts">لا توجد وظائف شاغرة حالياً.</p>'; return;
    }
    container.innerHTML = '';
    jobs.forEach(job => {
        const totalSalary = (job.base_salary || 0) + (job.housing_allowance || 0) + (job.transport_allowance || 0) + (job.other_allowances || 0);
        const cityName = job.city || job.location || 'مدينة غير محددة';
        const locationInfo = `${cityName}${job.specific_location ? ` - ${job.specific_location}` : ''}`;

        container.insertAdjacentHTML('beforeend', `
            <div class="contract-card">
                <div class="contract-card-header"><h4>${job.title}</h4></div>
                <div class="contract-card-body">
                    <p><i class="ph-bold ph-briefcase"></i> <strong>المشروع:</strong> ${job.project || 'غير محدد'}</p>
                    <p><i class="ph-bold ph-map-pin"></i> <strong>الموقع:</strong> ${locationInfo}</p>
                    <p><i class="ph-bold ph-clock"></i> <strong>ساعات العمل:</strong> ${job.work_hours || 'غير محددة'} ساعات يومياً</p>
                    <p><i class="ph-bold ph-calendar-check"></i> <strong>أيام العمل:</strong> ${job.work_days_count || 'غير محددة'} أيام بالأسبوع</p>
                    <p><i class="ph-bold ph-money"></i> <strong>الراتب الإجمالي:</strong> ${totalSalary.toLocaleString('ar-SA')} ر.س</p>
                </div>
                <div class="contract-card-footer">
                    <button class="btn btn-primary apply-for-job-btn" data-job-id="${job.id}" data-job-title="${job.title}">
                        <i class="ph-bold ph-paper-plane-tilt"></i> قدم الآن
                    </button>
                </div>
            </div>`
        );
    });
}
// نهاية الكود الجديد والمُصحح

document.addEventListener('click', async (event) => {
    // --- منطق النقر على التبويبات ---
    const publicTab = event.target.closest('.tabs .tab-link');
    if (publicTab) {
        event.preventDefault();
        const targetTabId = publicTab.dataset.tab;
        document.querySelectorAll('.tabs .tab-link').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        publicTab.classList.add('active');
        document.getElementById(targetTabId)?.classList.add('active');
        const jobsContainer = document.getElementById('public-jobs-list');
        if (targetTabId === 'jobs-tab' && !jobsContainer.hasChildNodes()) {
            fetchAndDisplayOpenJobs();
        }
        return;
    }

    // --- منطق فتح النوافذ ---
    const applyCoverageBtn = event.target.closest('.apply-now-btn');
    if (applyCoverageBtn) {
        document.getElementById('apply-shift-id').value = applyCoverageBtn.dataset.shiftId;
        document.getElementById('apply-modal').classList.remove('hidden');
        return;
    }

    const applyJobBtn = event.target.closest('.apply-for-job-btn');
    if (applyJobBtn) {
        document.getElementById('apply-job-id').value = applyJobBtn.dataset.jobId;
        document.getElementById('job-application-modal-title').textContent = `التقديم على وظيفة: ${applyJobBtn.dataset.jobTitle}`;
        document.getElementById('job-application-modal').classList.remove('hidden');
        return;
    }

    // --- منطق إغلاق أي نافذة ---
    const closeBtn = event.target.closest('.modal-close-btn');
    if (closeBtn) {
        closeBtn.closest('.modal-overlay').classList.add('hidden');
        return;
    }
    
    
});

// --- منطق تقديم طلب الوظيفة (للخارجيين فقط) ---
document.getElementById('job-application-form')?.addEventListener('submit', async function(event) {
    event.preventDefault();
    const submitBtn = document.getElementById('submit-job-application-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'جاري الإرسال...';
    
    try {
        const vacancyId = document.getElementById('apply-job-id').value;
        const idPhoto = document.getElementById('job-app-id-photo').files[0];
        const ibanCert = document.getElementById('job-app-iban-cert').files[0];
        if (!idPhoto || !ibanCert) throw new Error('الرجاء إرفاق الملفات المطلوبة.');

        const sanitizeFilename = (filename) => filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const idPhotoPath = `public/${vacancyId}-${Date.now()}-id-${sanitizeFilename(idPhoto.name)}`;
        const ibanCertPath = `public/${vacancyId}-${Date.now()}-iban-${sanitizeFilename(ibanCert.name)}`;
        
        const [idUploadResult, ibanUploadResult] = await Promise.all([
            supabaseClient.storage.from('job-applications').upload(idPhotoPath, idPhoto),
            supabaseClient.storage.from('job-applications').upload(ibanCertPath, ibanCert)
        ]);
        
        if (idUploadResult.error) throw new Error(`خطأ في رفع صورة الهوية`);
        if (ibanUploadResult.error) throw new Error(`خطأ في رفع شهادة الآيبان`);

        const applicationData = {
            vacancy_id: vacancyId,
            applicant_data: { 
                full_name: document.getElementById('job-app-full-name').value, 
                id_number: document.getElementById('job-app-id-number').value, 
                phone: document.getElementById('job-app-phone').value, 
                iban: document.getElementById('job-app-iban').value,
                bank_name: document.getElementById('job-app-bank-name').value
            },
            id_photo_url: idUploadResult.data.path,
            iban_certificate_url: ibanUploadResult.data.path,
            status: 'pending_supervisor'
        };

        const { error: insertError } = await supabaseClient.from('job_applications').insert([applicationData]);
        if (insertError) throw insertError;
        
        alert('تم إرسال طلبك بنجاح!');
        document.getElementById('job-application-modal').classList.add('hidden');
        this.reset();

    } catch (error) {
        alert('حدث خطأ: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'إرسال طلب التوظيف';
    }
});
// نهاية الكود النهائي

document.addEventListener('DOMContentLoaded', () => {
    // --- تفعيل زر الاختيار الجديد في نافذة التغطية ---
    const isEmployeeCheckboxCoverage = document.getElementById('is-employee-checkbox-coverage');
    if (isEmployeeCheckboxCoverage) {
        isEmployeeCheckboxCoverage.addEventListener('change', function() {
            const employeeField = document.getElementById('employee-id-field-coverage');
            const externalFields = document.getElementById('external-applicant-fields-coverage');
            const externalInputs = externalFields.querySelectorAll('input');

            if (this.checked) {
                employeeField.classList.remove('hidden');
                externalFields.classList.add('hidden');
                externalInputs.forEach(input => input.required = false);
                employeeField.querySelector('input').required = true;
            } else {
                employeeField.classList.add('hidden');
                externalFields.classList.remove('hidden');
                externalInputs.forEach(input => input.required = true);
                employeeField.querySelector('input').required = false;
            }
        });
        isEmployeeCheckboxCoverage.dispatchEvent(new Event('change'));
    }
    
// --- منطق تقديم طلب التغطية (مع رفع المرفقات) ---
document.getElementById('coverage-application-form')?.addEventListener('submit', async function(event) {
    event.preventDefault();
    const submitBtn = document.getElementById('submit-application-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'جاري الإرسال...';
    
    try {
        const isEmployee = document.getElementById('is-employee-checkbox-coverage').checked;
        const shiftId = document.getElementById('apply-shift-id').value;
        let applicationData;

        if (isEmployee) {
            // منطق الموظف الحالي (لا يتطلب مرفقات)
            const employeeIdNumber = document.getElementById('coverage-app-employee-id').value;
            if (!employeeIdNumber) throw new Error('الرجاء إدخال رقم الهوية.');
            const { data: user, error: userError } = await supabaseClient.from('users').select('id, name').eq('id_number', employeeIdNumber).single();
            if (userError || !user) throw new Error('رقم الهوية غير صحيح أو غير مسجل.');
            
            applicationData = {
                shift_id: shiftId, applicant_user_id: user.id,
                full_name: user.name, id_number: employeeIdNumber,
                status: 'pending_ops' // يذهب مباشرة للعمليات
            };
        } else {
            // منطق المتقدم الخارجي (مع رفع المرفقات)
            const idPhoto = document.getElementById('coverage-app-id-photo').files[0];
            const ibanCert = document.getElementById('coverage-app-iban-cert').files[0];
            if (!idPhoto || !ibanCert) throw new Error('الرجاء إرفاق صورة الهوية وشهادة الآيبان.');

            const sanitizeFilename = (filename) => filename.replace(/[^a-zA-Z0-9._-]/g, '_');
            const idPhotoPath = `public/coverage/${shiftId}-${Date.now()}-id-${sanitizeFilename(idPhoto.name)}`;
            const ibanCertPath = `public/coverage/${shiftId}-${Date.now()}-iban-${sanitizeFilename(ibanCert.name)}`;
            
            const [idUploadResult, ibanUploadResult] = await Promise.all([
                supabaseClient.storage.from('job-applications').upload(idPhotoPath, idPhoto),
                supabaseClient.storage.from('job-applications').upload(ibanCertPath, ibanCert)
            ]);
            
            if (idUploadResult.error) throw new Error(`خطأ في رفع صورة الهوية`);
            if (ibanUploadResult.error) throw new Error(`خطأ في رفع شهادة الآيبان`);

            applicationData = {
                shift_id: shiftId,
                full_name: document.getElementById('apply-full-name').value,
                id_number: document.getElementById('apply-id-number').value,
                phone_number: document.getElementById('apply-phone').value,
                iban: document.getElementById('apply-iban').value,
                bank_name: document.getElementById('apply-bank-name').value,
                id_photo_url: idUploadResult.data.path,
                iban_certificate_url: ibanUploadResult.data.path,
                status: 'pending_supervisor' // يذهب أولاً للمشرف
            };
        }

        const { error: insertError } = await supabaseClient.from('coverage_applicants').insert([applicationData]);
        if (insertError) throw insertError;
        
        alert('تم إرسال طلبك بنجاح!');
        document.getElementById('apply-modal').classList.add('hidden');
        this.reset();
        document.getElementById('is-employee-checkbox-coverage').dispatchEvent(new Event('change'));

    } catch(error){
        alert('حدث خطأ أثناء إرسال طلبك: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'إرسال الطلب';
    }
});
    // تحميل التغطيات عند فتح الصفحة
    fetchAndDisplayOpenShifts();
});
