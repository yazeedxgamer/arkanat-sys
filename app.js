
// ==========================================================
// ===       دالة تحميل قالب إدخال العقود بالعربي        ===
// ==========================================================
async function downloadContractTemplate() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('قالب إدخال المشاريع');

    // استخدام عناوين قصيرة ومباشرة
    worksheet.columns = [
        { header: 'اسم المشروع', key: 'ProjectName', width: 40 },
        { header: 'تاريخ نهاية العقد', key: 'ContractEndDate', width: 20 },
        { header: 'المنطقة', key: 'ContractRegion', width: 15 },
        { header: 'المدينة', key: 'City', width: 20 },
        { header: 'اسم الموقع', key: 'LocationName', width: 30 },
        { header: 'إحداثيات الموقع', key: 'LocationCoords', width: 25 },
        { header: 'اسم الوردية', key: 'ShiftName', width: 20 },
        { header: 'عدد الحراس', key: 'GuardsCount', width: 15 },
        { header: 'وقت البدء', key: 'StartTime', width: 15 },
        { header: 'وقت الانتهاء', key: 'EndTime', width: 15 },
        { header: 'أيام العمل (1=الأحد..7=السبت)', key: 'WorkDays', width: 45 }
    ];

    // تنسيق العناوين
    worksheet.getRow(1).eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF198754' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'قالب_إدخال_المشاريع_والمواقع.xlsx';
    link.click();
}

// ==========================================================
// ===        الدالة الرئيسية لمعالجة ملف العقود           ===
// ==========================================================
async function processContractFile(file) {
    const resultsContainer = document.getElementById('contract-import-results-container');
    const uploadBtn = document.getElementById('import-contracts-btn');
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="ph-fill ph-spinner-gap animate-spin"></i> جاري المعالجة...';
    resultsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">بدأت المعالجة، يرجى الانتظار...</p>';

    try {
        const buffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.getWorksheet(1);

        const headerMap = {};
        worksheet.getRow(1).eachCell((cell, colNumber) => {
            headerMap[cell.value] = colNumber;
        });
        
        const dayMap = { '1': 'Sun', '2': 'Mon', '3': 'Tue', '4': 'Wed', '5': 'Thu', '6': 'Fri', '7': 'Sat' };
        const groupedData = {};

        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber > 1) {
                const projectName = row.getCell(headerMap['اسم المشروع']).value;
                const locationName = row.getCell(headerMap['اسم الموقع']).value;
                if (!projectName || !locationName) return;

                if (!groupedData[projectName]) {
                    groupedData[projectName] = {
                        company_name: projectName,
                        end_date: row.getCell(headerMap['تاريخ نهاية العقد']).value || null,
                        region: row.getCell(headerMap['المنطقة']).value,
                        city: row.getCell(headerMap['المدينة']).value,
                        status: 'active',
                        locations: {}
                    };
                }

                if (!groupedData[projectName].locations[locationName]) {
                     groupedData[projectName].locations[locationName] = {
                        name: locationName,
                        city: row.getCell(headerMap['المدينة']).value,
                        region: groupedData[projectName].region,
                        geofence_link: row.getCell(headerMap['إحداثيات الموقع']).value || null,
                        geofence_radius: 200,
                        shifts: []
                    };
                }
                
                const startTimeValue = row.getCell(headerMap['وقت البدء']).value;
                const endTimeValue = row.getCell(headerMap['وقت الانتهاء']).value;
                let workHours = 0;
                
                const formatExcelTime = (timeValue) => {
                    if (typeof timeValue === 'number' && timeValue < 1) {
                        const totalSeconds = timeValue * 24 * 60 * 60;
                        const hours = Math.floor(totalSeconds / 3600);
                        const minutes = Math.floor((totalSeconds % 3600) / 60);
                        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                    }
                    if(typeof timeValue === 'object' && timeValue.text) return timeValue.text;
                    if(typeof timeValue === 'object' && timeValue instanceof Date) {
                        return `${String(timeValue.getHours()).padStart(2, '0')}:${String(timeValue.getMinutes()).padStart(2, '0')}`;
                    }
                    return timeValue;
                };

                const startTime = formatExcelTime(startTimeValue);
                const endTime = formatExcelTime(endTimeValue);

                if (startTime && endTime) {
                    const start = new Date(`1970-01-01T${startTime}`);
                    const end = new Date(`1970-01-01T${endTime}`);
                    let diff = (end - start) / (1000 * 60 * 60);
                    if (diff < 0) diff += 24;
                    workHours = parseFloat(diff.toFixed(2));
                }

                const workDaysInput = String(row.getCell(headerMap['أيام العمل (1=الأحد..7=السبت)']).value || '');
                const workDaysArray = workDaysInput.split(',').map(num => dayMap[num.trim()]).filter(day => day);

                groupedData[projectName].locations[locationName].shifts.push({
                    name: row.getCell(headerMap['اسم الوردية']).value,
                    guards_count: parseInt(row.getCell(headerMap['عدد الحراس']).value, 10) || 1,
                    start_time: startTime,
                    end_time: endTime,
                    work_hours: workHours,
                    days: workDaysArray
                });
            }
        });

        let successCount = 0;
        let errorCount = 0;
        let resultsLog = [];

        for (const projectName in groupedData) {
            try {
                const contract = groupedData[projectName];
                const { data: existingContract } = await supabaseClient.from('contracts').select('id').eq('company_name', projectName).maybeSingle();
                if (existingContract) {
                    throw new Error('هذا المشروع موجود بالفعل في النظام.');
                }

                const locationsArray = Object.values(contract.locations);
                
                const finalContractData = {
                    company_name: contract.company_name,
                    end_date: contract.end_date,
                    region: contract.region,
                    city: [contract.city],
                    status: 'active',
                    contract_locations: locationsArray
                };

                const { error } = await supabaseClient.from('contracts').insert([finalContractData]);
                if (error) throw error;
                
                successCount++;
                resultsLog.push({ name: projectName, status: 'success', message: `تمت إضافة المشروع بنجاح مع ${locationsArray.length} موقع.` });
            } catch (e) {
                errorCount++;
                resultsLog.push({ name: projectName, status: 'error', message: e.message });
            }
        }

        let reportHtml = `
            <h4 style="text-align:center; margin: 20px 0;">اكتملت المعالجة: ${successCount} نجاح، ${errorCount} فشل</h4>
            <div class="table-container"><table><thead><tr><th>اسم المشروع</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>
            ${resultsLog.map(r => `<tr style="background-color: ${r.status === 'success' ? '#f0fff4' : '#fff5f5'};">
                <td>${r.name}</td>
                <td><span class="status ${r.status === 'success' ? 'active' : 'inactive'}">${r.status === 'success' ? 'نجاح' : 'فشل'}</span></td>
                <td>${r.message}</td>
            </tr>`).join('')}
            </tbody></table></div>`;
        resultsContainer.innerHTML = reportHtml;
        fetchContracts();

    } catch (error) {
        console.error("The process failed with this error:", error);
        resultsContainer.innerHTML = `<p style="color:red; text-align:center; padding: 20px;">خطأ فادح: ${error.message}</p>`;
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="ph-bold ph-file-xls"></i> استيراد من ملف';
        document.getElementById('contract-import-input').value = '';
    }
}



// ==========================================================
// ===       دالة تحميل قالب إدخال الموظفين بالعربي       ===
// ==========================================================
async function downloadEmployeeTemplate() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('قالب إدخال الموظفين');

    // تحديد الأعمدة والعناوين باللغة العربية
worksheet.columns = [
    { header: 'الاسم الكامل', key: 'name', width: 30 },
    { header: 'رقم الهوية', key: 'id_number', width: 15 },
    { header: 'رقم الجوال', key: 'phone', width: 15 },
    { header: 'تاريخ المباشرة', key: 'start_date', width: 15 },
    { header: 'رقم الآيبان', key: 'iban', width: 30 },
    { header: 'اسم البنك', key: 'bank', width: 15 },
    { header: 'حالة الموظف', key: 'status', width: 15 },
    { header: 'اسم المشروع', key: 'project', width: 25 },
    { header: 'اسم الموقع', key: 'location', width: 25 },
    { header: 'اسم الوردية', key: 'shift', width: 20 },
    { header: 'مسجل بالتأمينات (نعم/لا)', key: 'is_insured', width: 25 },
    { header: 'مبلغ خصم التأمينات', key: 'insurance_amount', width: 20 }
];

    // تجميد الصف الأول (العناوين)
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // تنسيق العناوين
    worksheet.getRow(1).eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
        cell.alignment = { horizontal: 'center' };
    });

    // إنشاء الملف وتنزيله
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'قالب_إدخال_الموظفين.xlsx';
    link.click();
}


// ==========================================================
// ===       دالة تحميل قالب إدخال العقود بالعربي        ===
// ==========================================================


// ==========================================================
// ===        الدالة الرئيسية لمعالجة ملف العقود           ===
// ==========================================================
async function processContractFile(file) {
    const resultsContainer = document.getElementById('contract-import-results-container');
    const uploadBtn = document.getElementById('import-contracts-btn');
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="ph-fill ph-spinner-gap animate-spin"></i> جاري المعالجة...';
    resultsContainer.innerHTML = '<p style="text-align:center; padding: 20px;">بدأت المعالجة، يرجى الانتظار...</p>';

    try {
        const buffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.getWorksheet(1);

        const headerMap = {};
        worksheet.getRow(1).eachCell((cell, colNumber) => {
            headerMap[cell.value] = colNumber;
        });
        
        const dayMap = { '1': 'Sun', '2': 'Mon', '3': 'Tue', '4': 'Wed', '5': 'Thu', '6': 'Fri', '7': 'Sat' };
        const groupedData = {};

        // --- بداية التعديل: تغيير طريقة قراءة الصفوف ---
        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
            const row = worksheet.getRow(rowNumber);
            if (row.cellCount === 0) continue; // تخطي الصفوف الفارغة تمامًا

            const projectName = row.getCell(headerMap['اسم المشروع']).value;
            const locationName = row.getCell(headerMap['اسم الموقع']).value;
            if (!projectName || !locationName) continue;

            if (!groupedData[projectName]) {
                groupedData[projectName] = {
                    company_name: projectName,
                    end_date: row.getCell(headerMap['تاريخ نهاية العقد']).value || null,
                    region: row.getCell(headerMap['المنطقة']).value,
                    city: row.getCell(headerMap['المدينة']).value,
                    status: 'active',
                    locations: {}
                };
            }

            if (!groupedData[projectName].locations[locationName]) {
                 groupedData[projectName].locations[locationName] = {
                    name: locationName,
                    city: row.getCell(headerMap['المدينة']).value,
                    region: groupedData[projectName].region,
                    geofence_link: row.getCell(headerMap['إحداثيات الموقع']).value || null,
                    geofence_radius: 200,
                    shifts: []
                };
            }
            
            const startTimeValue = row.getCell(headerMap['وقت البدء']).value;
            const endTimeValue = row.getCell(headerMap['وقت الانتهاء']).value;
            let workHours = 0;
            
            const formatExcelTime = (timeValue) => {
                if (typeof timeValue === 'number' && timeValue < 1) {
                    const totalSeconds = timeValue * 24 * 60 * 60;
                    const hours = Math.floor(totalSeconds / 3600);
                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                }
                if(typeof timeValue === 'object' && timeValue.text) return timeValue.text;
                if(typeof timeValue === 'object' && timeValue instanceof Date) {
                    return `${String(timeValue.getHours()).padStart(2, '0')}:${String(timeValue.getMinutes()).padStart(2, '0')}`;
                }
                return timeValue;
            };

            const startTime = formatExcelTime(startTimeValue);
            const endTime = formatExcelTime(endTimeValue);

            if (startTime && endTime) {
                const start = new Date(`1970-01-01T${startTime}`);
                const end = new Date(`1970-01-01T${endTime}`);
                let diff = (end - start) / (1000 * 60 * 60);
                if (diff < 0) diff += 24;
                workHours = parseFloat(diff.toFixed(2));
            }

            const workDaysInput = String(row.getCell(headerMap['أيام العمل (1=الأحد..7=السبت)']).value || '');
            const workDaysArray = workDaysInput.split(',').map(num => dayMap[num.trim()]).filter(day => day);

            groupedData[projectName].locations[locationName].shifts.push({
                name: row.getCell(headerMap['اسم الوردية']).value,
                guards_count: parseInt(row.getCell(headerMap['عدد الحراس']).value, 10) || 1,
                start_time: startTime,
                end_time: endTime,
                work_hours: workHours,
                days: workDaysArray
            });
        }
        // --- نهاية التعديل ---

        let successCount = 0;
        let errorCount = 0;
        let resultsLog = [];

        for (const projectName in groupedData) {
            try {
                const contract = groupedData[projectName];
                const { data: existingContract } = await supabaseClient.from('contracts').select('id').eq('company_name', projectName).maybeSingle();
                if (existingContract) {
                    throw new Error('هذا المشروع موجود بالفعل في النظام.');
                }

                const locationsArray = Object.values(contract.locations);
                
                const finalContractData = {
                    company_name: contract.company_name,
                    end_date: contract.end_date,
                    region: contract.region,
                    city: [contract.city],
                    status: 'active',
                    contract_locations: locationsArray
                };

                const { error } = await supabaseClient.from('contracts').insert([finalContractData]);
                if (error) throw error;
                
                successCount++;
                resultsLog.push({ name: projectName, status: 'success', message: `تمت إضافة المشروع بنجاح مع ${locationsArray.length} موقع.` });
            } catch (e) {
                errorCount++;
                resultsLog.push({ name: projectName, status: 'error', message: e.message });
            }
        }

        let reportHtml = `
            <h4 style="text-align:center; margin: 20px 0;">اكتملت المعالجة: ${successCount} نجاح، ${errorCount} فشل</h4>
            <div class="table-container"><table><thead><tr><th>اسم المشروع</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>
            ${resultsLog.map(r => `<tr style="background-color: ${r.status === 'success' ? '#f0fff4' : '#fff5f5'};">
                <td>${r.name}</td>
                <td><span class="status ${r.status === 'success' ? 'active' : 'inactive'}">${r.status === 'success' ? 'نجاح' : 'فشل'}</span></td>
                <td>${r.message}</td>
            </tr>`).join('')}
            </tbody></table></div>`;
        resultsContainer.innerHTML = reportHtml;
        fetchContracts();

    } catch (error) {
        console.error("The process failed with this error:", error);
        resultsContainer.innerHTML = `<p style="color:red; text-align:center; padding: 20px;">خطأ فادح: ${error.message}</p>`;
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="ph-bold ph-file-xls"></i> استيراد من ملف';
        document.getElementById('contract-import-input').value = '';
    }
}


window.addEventListener('error', function(event) {
    const errorData = {
        user_id: window.currentUser?.auth_user_id || null,
        user_name: window.currentUser?.name || 'غير مسجل',
        error_message: event.message,
        stack_trace: event.error?.stack || 'N/A',
        user_agent: navigator.userAgent
    };
    // نستخدم then لتجنب إيقاف البرنامج إذا فشلت عملية التسجيل
    supabaseClient.from('error_logs').insert(errorData).then(({ error }) => {
        if (error) console.error('Failed to log error to Supabase:', error);
    });
});
async function displayActiveAnnouncements() {
    const banner = document.getElementById('announcement-banner');
    if (!banner) return;

    // إخفاء الشريط مبدئياً
    banner.classList.add('hidden');
    banner.innerHTML = '';

    try {
        const now = new Date().toISOString();
        
        // جلب الإعلانات التي تكون نشطة والآن بين تاريخ البداية والنهاية
        const { data: activeAnnouncements, error } = await supabaseClient
            .from('announcements')
            .select('content, type')
            .eq('is_active', true)
            .lte('start_date', now) // تاريخ البداية أصغر من أو يساوي الآن
            .gte('end_date', now)   // تاريخ النهاية أكبر من أو يساوي الآن
            .order('created_at', { ascending: false });

        if (error) throw error;

        // إذا وجدنا إعلاناً فعالاً، نعرض أول واحد فقط
        if (activeAnnouncements && activeAnnouncements.length > 0) {
            const announcement = activeAnnouncements[0];
            
            // تحديث محتوى وتصميم الشريط
            banner.innerHTML = `
                <p>${announcement.content}</p>
                <button id="close-announcement-btn" title="إخفاء الإعلان">X</button>
            `;
            // إزالة كلاسات الألوان القديمة وإضافة الجديد
            banner.classList.remove('type-info', 'type-warning', 'type-critical');
            banner.classList.add(`type-${announcement.type}`);

            // إظهار الشريط
            banner.classList.remove('hidden');

            // إضافة وظيفة لزر الإغلاق
            document.getElementById('close-announcement-btn').addEventListener('click', () => {
                banner.classList.add('hidden');
            });
        }

    } catch (err) {
        console.error("Error fetching announcements:", err);
    }
}

// ==========================================================
// ===   بداية الاستبدال الكامل لدالة معالجة ملف الموظفين   ===
// ==========================================================
async function processEmployeeFile(file) {
    const resultsContainer = document.getElementById('import-results-container');
    const uploadBtn = document.getElementById('upload-employees-file-btn');
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="ph-fill ph-spinner-gap animate-spin"></i> جاري المعالجة الذكية...';
    resultsContainer.innerHTML = '<p style="text-align:center;">بدأت المعالجة، قد تستغرق العملية بعض الوقت...</p>';

    try {
        const buffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.getWorksheet(1);

        // 1. قراءة البيانات من الملف كما هي
        const headerMap = {};
        const expectedHeaders = ['الاسم الكامل', 'رقم الهوية', 'رقم الجوال', 'تاريخ المباشرة', 'رقم الآيبان', 'اسم البنك', 'حالة الموظف', 'اسم المشروع', 'اسم الموقع', 'اسم الوردية', 'مسجل بالتأمينات (نعم/لا)', 'مبلغ خصم التأمينات'];
        worksheet.getRow(1).eachCell((cell, colNumber) => {
            if (expectedHeaders.includes(cell.value)) {
                headerMap[cell.value] = colNumber;
            }
        });
        if (Object.keys(headerMap).length !== expectedHeaders.length) {
            throw new Error('القالب المستخدم غير صحيح أو أن هناك أعمدة مفقودة. الرجاء تحميل القالب الرسمي.');
        }

        let employeesData = [];
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber > 1) {
                employeesData.push({
                    rowNum: rowNumber,
                    name: row.getCell(headerMap['الاسم الكامل']).value,
                    id_number: row.getCell(headerMap['رقم الهوية']).value,
                    phone: row.getCell(headerMap['رقم الجوال']).value,
                    start_date: row.getCell(headerMap['تاريخ المباشرة']).value,
                    iban: row.getCell(headerMap['رقم الآيبان']).value,
                    bank: row.getCell(headerMap['اسم البنك']).value,
                    status: row.getCell(headerMap['حالة الموظف']).value,
                    project: row.getCell(headerMap['اسم المشروع']).value,
                    location: row.getCell(headerMap['اسم الموقع']).value,
                    shift: row.getCell(headerMap['اسم الوردية']).value,
                    isInsured: row.getCell(headerMap['مسجل بالتأمينات (نعم/لا)']).value,
                    insuranceAmount: row.getCell(headerMap['مبلغ خصم التأمينات']).value,
                });
            }
        });
        if (employeesData.length === 0) throw new Error('الملف فارغ.');
        
        // 2. إرسال البيانات للدالة السحابية الذكية
        const { data, error } = await supabaseClient.functions.invoke('smart-process-employees', {
            body: { employeesData }
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);
        
        const finalResults = data.results;

        // 3. عرض التقرير النهائي العائد من الدالة السحابية
        const successCount = finalResults.filter(r => r.result.status === 'success').length;
        const errorCount = finalResults.filter(r => r.result.status === 'error').length;
        let reportHtml = `
            <h4 style="text-align:center; margin-bottom: 20px;">
                اكتملت المعالجة: ${successCount} نجاح، ${errorCount} فشل
            </h4>
            <div class="table-container">
                <table>
                    <thead><tr><th>#</th><th>الاسم</th><th>الحالة</th><th>ملاحظات</th></tr></thead>
                    <tbody>
                        ${finalResults.map(r => `
                            <tr style="background-color: ${r.result.status === 'success' ? '#f0fff4' : '#fff5f5'};">
                                <td>${r.rowNum}</td>
                                <td>${r.name}</td>
                                <td><span class="status ${r.result.status === 'success' ? 'active' : 'inactive'}">${r.result.status === 'success' ? 'نجاح' : 'فشل'}</span></td>
                                <td style="text-align: right;">${r.result.message}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        resultsContainer.innerHTML = reportHtml;
        loadEmployeeTabData();
        loadVacancyTabData();

    } catch (e) {
        resultsContainer.innerHTML = `<p style="color:red; text-align:center; padding: 20px;">حدث خطأ فادح: ${e.message}</p>`;
        console.error("Employee File Processing Error:", e);
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="ph-bold ph-upload-simple"></i> اختيار ورفع ملف Excel';
    }
}
// ==========================================================
// ===    نهاية الاستبدال الكامل لدالة معالجة ملف الموظفين   ===
// ==========================================================
// ==========================================================
// ===   بداية دالة مساعدة لفلترة المشاريع بشكل صحيح     ===
// ==========================================================
function createProjectFilter(query, projectData, columnName = 'project') {
    // إذا لم يكن للمشرف أي مشاريع، نرجع استعلاماً فارغاً لمنع عرض جميع البيانات
    if (!projectData || !Array.isArray(projectData) || projectData.length === 0) {
        // A non-existent UUID to ensure no results are returned
        return query.eq('id', '00000000-0000-0000-0000-000000000000'); 
    }

    // دالة لتحويل مصفوفة جافاسكريبت إلى صيغة نصية تفهمها قاعدة البيانات
    // مثال: ['Project A', 'Project B'] تصبح '{"Project A","Project B"}'
    const toPostgresArrayLiteral = (arr) => {
        const formattedElements = arr.map(element => `"${element.replace(/"/g, '""')}"`);
        return `{${formattedElements.join(',')}}`;
    };

    // *** هنا تم التصحيح: استخدام العامل 'ov' (overlaps) ***
    // هذا العامل يتحقق بشكل صحيح من وجود أي عنصر مشترك بين مصفوفتين نصيتين
    return query.filter(columnName, 'ov', toPostgresArrayLiteral(projectData));
}
// ==========================================================
// ===    نهاية دالة مساعدة لفلترة المشاريع بشكل صحيح    ===
// ==========================================================

let pendingPaymentsData = [];
let absenteeReportData = [];
// Initialize Firebase
firebase.initializeApp(config.firebaseConfig);
const messaging = firebase.messaging();
function requestNotificationPermission() {
    messaging.requestPermission()
        .then(() => messaging.getToken({
            vapidKey: "BO_qk6HKfERdBr4geUGLjQKk0D7830kjunWm3CY9q2WMQ2lkj5006t92lY-uVIlGarAZBYGKKz4jCLq7aMYqb7o"
        }))
        .then(token => {
            console.log("توكن FCM:", token);
            // هنا ترسله للسيرفر حقك أو تخزنه حسب حاجتك
        })
        .catch(err => {
            console.error("خطأ أثناء طلب الإذن:", err);
        });
}

messaging.onMessage(payload => {
    console.log("رسالة أثناء فتح الصفحة:", payload);
});

// ==================== بداية الدوال المساعدة للنطاق الجغرافي ====================
// بداية الاستبدال

/**
 * دالة محسّنة لتحليل الإحداثيات من رابط خرائط جوجل أو من نص إحداثيات مباشر
 * @param {string} input - رابط خرائط جوجل أو نص بصيغة "lat,lng"
 * @returns {object|null} - كائن يحتوي على خط الطول والعرض أو null
 */
function parseCoordinates(input) {
    if (!input || typeof input !== 'string') return null;

    // الحالة 1: محاولة تحليل الإحداثيات المباشرة (e.g., "24.7111, 46.6800")
    let match = input.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
    if (match && match.length >= 3) {
        return {
            lat: parseFloat(match[1]),
            lng: parseFloat(match[2])
        };
    }

    // الحالة 2: إذا فشلت الأولى، محاولة تحليل رابط جوجل ماب الكامل
    match = input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match && match.length >= 3) {
        return {
            lat: parseFloat(match[1]),
            lng: parseFloat(match[2])
        };
    }

    return null; // إذا فشلت كل المحاولات
}

// نهاية الاستبدال

/**
 * دالة لحساب المسافة بين نقطتين على الأرض (بالمتر)
 * @param {object} coords1 - الإحداثيات الأولى {lat, lng}
 * @param {object} coords2 - الإحداثيات الثانية {lat, lng}
 * @returns {number} - المسافة بالمتر
 */
function calculateDistance(coords1, coords2) {
    const R = 6371e3; // نصف قطر الأرض بالمتر
    const φ1 = coords1.lat * Math.PI / 180;
    const φ2 = coords2.lat * Math.PI / 180;
    const Δφ = (coords2.lat - coords1.lat) * Math.PI / 180;
    const Δλ = (coords2.lng - coords1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // المسافة بالمتر
}
// دالة لإظهار نافذة التنبيهات المخصصة
function showCustomAlert(title, message, type = 'info') { // types: info, success, error
    const modal = document.getElementById('custom-alert-modal');
    const modalTitle = document.getElementById('custom-alert-title');
    const modalMessage = document.getElementById('custom-alert-message');
    const modalHeader = document.getElementById('custom-alert-header');

    modalTitle.textContent = title;
    modalMessage.textContent = message;

    // تغيير لون الهيدر بناءً على نوع الرسالة
    modalHeader.className = 'modal-header'; // إعادة تعيين الكلاسات
    modalHeader.classList.add(type);

    modal.classList.remove('hidden');
}
// ===================== نهاية الدوال المساعدة =====================
// --- نهاية كود تهيئة Firebase ---
// --- الخطوة 4: إعداد الاتصال مع قاعدة البيانات ---

const supabaseClient = supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
// --- دالة مساعدة لتحويل مفتاح VAPID إلى الصيغة المطلوبة ---
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
let currentUser = null; // متغير لتخزين معلومات المستخدم الذي سجل دخوله
let locationWatcherId = null; // متغير لتخزين معرّف عملية تتبع الموقع
let guardMarkers = new Map(); // متغير لتخزين علامات الحراس على الخريطة
// بداية الإضافة
let patrolWatcherId = null; // متغير لتخزين معرّف عملية تتبع الجولة
// نهاية الإضافة
let payrollExportData = []; // لتخزين بيانات مسير الرواتب الجاهزة للتصدير
// بداية الإضافة: أضف هذا الكود في ملف app.js
function formatTimeAMPM(timeString) {
    if (!timeString) return 'غير محدد';
    const [hours, minutes] = timeString.split(':');
    let h = parseInt(hours);
    const ampm = h >= 12 ? 'م' : 'ص';
    h = h % 12;
    h = h ? h : 12; // الساعة 0 أو 12 تبقى 12
    const m = minutes.padStart(2, '0');
    return `${h}:${m} ${ampm}`;
}
// نهاية الإضافة

// بداية الإضافة: دالة إرسال الإشعارات الشاملة

/**
 * دالة لإرسال إشعار لمستخدم معين أو لمجموعة مستخدمين.
 * @param {number[] | number} userIds - الـ ID الخاص بالمستخدم أو مصفوفة من IDs.
 * @param {string} title - عنوان الإشعار.
 * @param {string} body - نص الإشعار.
 * @param {string} [link='/'] - الرابط الذي سيتم فتحه عند النقر.
 */
async function sendNotification(userIds, title, body, link = '/') {
    // التأكد من أن userIds هو مصفوفة دائماً لتسهيل التعامل
    const targetUserIds = Array.isArray(userIds) ? userIds : [userIds];

    if (targetUserIds.length === 0) return;

    try {
        // 1. تجهيز سجلات الإشعارات لحفظها في قاعدة البيانات
        const notificationRecords = targetUserIds.map(id => ({
            user_id: id,
            title: title,
            body: body,
            link: link
        }));

        // 2. حفظ كل الإشعارات في قاعدة البيانات دفعة واحدة
        await supabaseClient.from('notifications').insert(notificationRecords);

        // 3. إرسال الإشعارات الفعلية لكل مستخدم على حدة
        for (const userId of targetUserIds) {
            // استدعاء الوظيفة الخلفية لكل مستخدم
            supabaseClient.functions.invoke('send-fcm-notification', {
                body: { userId, title, body, link },
            }).then(({ data, error }) => {
                if (error) {
                    console.error(`Error invoking FCM for user ${userId}:`, error);
                } else {
                    console.log(`FCM function invoked for user ${userId}:`, data);
                }
            });
        }
    } catch (e) {
        console.error('An unexpected error occurred in sendNotification:', e);
    }
}

// نهاية الإضافة
// --- دوال نظام الإشعارات والتنبيهات ---

// دالة لإظهار تنبيه Toast
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const icon = type === 'success' ? 'ph-check-circle' : 'ph-x-circle';
    toast.className = `toast-message ${type}`;
    toast.innerHTML = `<i class="ph-bold ${icon}"></i> <p>${message}</p>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000); // إزالة التنبيه بعد 4 ثوانٍ
}

// دالة لتحديث عدد الإشعارات في الجرس
// دالة لتحديث عدد الإشعارات في الجرس (النسخة المصححة)
async function updateNotificationBell() {
    if (!currentUser) return;

    // --- بداية التصحيح ---
    // تم تغيير الربط من auth_user_id إلى id ليطابق قاعدة البيانات
    const { count, error } = await supabaseClient
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id) // <-- هنا كان الخطأ
        .eq('is_read', false);
    // --- نهاية التصحيح ---

    const badge = document.getElementById('notification-count-badge');
    if (error) {
        console.error("Error fetching notification count:", error);
        badge.classList.add('hidden');
        return;
    }

    if (count > 0) {
        badge.textContent = count > 9 ? '9+' : count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// بداية الإضافة
function stopPatrolTracking() {
    if (patrolWatcherId) {
        navigator.geolocation.clearWatch(patrolWatcherId);
        patrolWatcherId = null;
        console.log('تم إيقاف تتبع الجولة.');
    }
}




function startPatrolTracking(patrolId) {
    stopPatrolTracking(); // إيقاف أي متتبع قديم أولاً
    console.log(`بدء تتبع الجولة رقم: ${patrolId}`);

    patrolWatcherId = navigator.geolocation.watchPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            const newCoordinate = { lat: latitude, lng: longitude, time: new Date().toISOString() };

            // 1. تحديث الموقع المباشر للمشرف على الخريطة
            await supabaseClient.from('guard_locations')
                .upsert({ guard_id: currentUser.id, latitude, longitude }, { onConflict: 'guard_id' });

            // 2. تحديث مسار الجولة في جدول patrols
            // نجلب المسار الحالي أولاً
            const { data: currentPatrol, error: fetchError } = await supabaseClient
                .from('patrols')
                .select('path')
                .eq('id', patrolId)
                .single();

            if (fetchError) return console.error("Error fetching current path:", fetchError);

            // نضيف النقطة الجديدة للمسار
            const newPath = (currentPatrol.path || []);
            newPath.push(newCoordinate);

            // نحدث السجل بالمسار الجديد
            await supabaseClient
                .from('patrols')
                .update({ path: newPath })
                .eq('id', patrolId);
        },
        (error) => {
            console.error("خطأ في تتبع الجولة:", error);
            stopPatrolTracking();
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
}
// نهاية الإضافة

// --- دالة تحميل طلبات التغطية للمشرف ---
async function loadSupervisorCoverageAppsPage() {
    const container = document.getElementById('supervisor-coverage-apps-container');
    if (!container || !currentUser || !currentUser.project) return;
    container.innerHTML = '<p style="text-align: center;">جاري تحميل الطلبات...</p>';

    // --- هنا التصحيح: استخدام الدالة الذكية الجديدة والمصححة ---
    const { data: applications, error } = await supabaseClient.rpc('get_supervisor_coverage_apps_final', {
        p_supervisor_projects: currentUser.project
    });

    if (error) { 
        container.innerHTML = '<p style="color:red;">حدث خطأ.</p>'; 
        console.error(error); 
        return; 
    }
    if (!applications || applications.length === 0) { 
        container.innerHTML = '<p style="text-align: center;">لا توجد طلبات تغطية جديدة لمراجعتها.</p>'; 
        return; 
    }

    // بناء الواجهة من البيانات الصحيحة التي تم جلبها
    const groupedByShift = applications.reduce((acc, app) => {
        const shiftId = app.shift_id;
        if (!acc[shiftId]) {
            acc[shiftId] = { 
                details: { project: app.shift_project, location: app.shift_location }, 
                applicants: [] 
            };
        }
        acc[shiftId].applicants.push(app);
        return acc;
    }, {});

    container.innerHTML = '';
    for (const shiftId in groupedByShift) {
        const group = groupedByShift[shiftId];
        const groupHtml = `
            <div class="attendance-accordion" style="margin-bottom: 20px;">
                <details open>
                    <summary style="font-size: 1.3rem;">
                        تغطية في: ${group.details.project} - ${group.details.location}
                        <span class="status pending" style="margin-right: auto;">(${group.applicants.length} متقدم)</span>
                    </summary>
                    <div class="content" style="padding-top: 15px;">
                        ${group.applicants.map(applicant => `
                            <div class="attendance-card">
                                <span>${applicant.full_name}</span>
                                <div style="display: flex; gap: 10px;">
                                    <button class="btn btn-secondary btn-sm view-coverage-applicant-btn" data-appid="${applicant.applicant_id}">
                                        <i class="ph-bold ph-eye"></i> عرض التفاصيل
                                    </button>
                                    <button class="btn btn-success btn-sm nominate-coverage-applicant-btn" data-appid="${applicant.applicant_id}" data-shiftid="${shiftId}">
                                        <i class="ph-bold ph-check-fat"></i> ترشيح
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </details>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', groupHtml);
    }
}


async function loadArchivePage(requestType) {
    const containerId = `archive-${requestType}-tab`;
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `<p style="text-align: center; padding-top: 20px;">جاري تحميل الأرشيف...</p>`;
    
    const { data: requests, error } = await supabaseClient
        .from('employee_requests')
        .select(`*, users:user_id(name)`)
        .eq('request_type', requestType)
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<p style="color:red;">حدث خطأ في تحميل الأرشيف.</p>`;
        return console.error(error);
    }
    if (requests.length === 0) {
        container.innerHTML = `<p style="text-align: center;">لا توجد طلبات في الأرشيف.</p>`;
        return;
    }
    // إعادة استخدام نفس تصميم بطاقات المراجعة
    container.innerHTML = `<div class="all-requests-container" style="padding-top:20px;">${requests.map(request => {
        const headerStatusClass = request.status === 'مقبول' ? 'status-approved' : (request.status === 'مرفوض' ? 'status-denied' : 'status-pending');
        let detailsHtml = '';
        if (request.details) {
            if (request.details.days) detailsHtml += `<p><strong>المدة:</strong> ${request.details.days} أيام</p>`;
            if (request.details.amount) detailsHtml += `<p><strong>المبلغ:</strong> ${request.details.amount} ر.س</p>`;
            if (request.details.reason) detailsHtml += `<p><strong>السبب:</strong> ${request.details.reason}</p>`;
        }
        return `<div class="review-request-card"><div class="review-request-header ${headerStatusClass}"><h4>طلب من: ${request.users ? request.users.name : 'غير معروف'}</h4><span class="status-badge">${request.status}</span></div><div class="review-request-body">${detailsHtml}</div></div>`;
    }).join('')}</div>`;
}

// بداية الاستبدال
// ==========================================================
// ===   بداية الاستبدال الكامل لدالة loadOpsReviewRequestsPage   ===
// ==========================================================
async function loadOpsReviewRequestsPage() {
    const container = document.getElementById('ops-review-requests-container');
    if (!container || !currentUser || !currentUser.region) { 
        container.innerHTML = '<p>لا يمكن عرض الصفحة. الرجاء التأكد من تعيين منطقة لحسابك.</p>';
        return;
    }
    container.innerHTML = '<p style="text-align: center;">جاري تحميل الطلبات...</p>';

    // --- هنا التصحيح: تم تغيير الفلترة من project إلى region ---
    const { data: requests, error } = await supabaseClient
        .from('employee_requests')
        .select(`*, users:user_id!inner(name, region)`)
        .eq('status', 'معلق')
        .eq('users.region', currentUser.region); // <-- الفلترة الصحيحة حسب المنطقة

    if (error) { 
        container.innerHTML = '<p style="color:red;">حدث خطأ في جلب الطلبات.</p>'; 
        return console.error(error);
    }
    if (requests.length === 0) { 
        container.innerHTML = '<p style="text-align: center;">لا توجد طلبات معلقة من الموظفين في منطقتك حالياً.</p>'; 
        return;
    }
    
    container.innerHTML = '';
    requests.forEach(request => {
        const requestTypeTranslations = { leave: 'إجازة', resignation: 'استقالة', loan: 'سلفة', permission: 'استئذان' };
        const typeText = requestTypeTranslations[request.request_type] || request.request_type;
        let detailsHtml = '';
        if (request.details) {
            if (request.details.days) detailsHtml += `<p><strong>المدة:</strong> ${request.details.days} أيام</p>`;
            if (request.details.amount) detailsHtml += `<p><strong>المبلغ:</strong> ${request.details.amount} ر.س</p>`;
            if (request.details.reason) detailsHtml += `<p><strong>السبب:</strong> ${request.details.reason}</p>`;
        }
        const cardHtml = `
            <div class="review-request-card">
                <div class="review-request-header status-pending">
                    <h4>طلب ${typeText}</h4>
                    <span class="status-badge">${request.status}</span>
                </div>
                <div class="review-request-body">
                    <div class="request-meta-grid" style="grid-template-columns: 1fr;">
                        <div class="request-meta-item">
                            <i class="ph-bold ph-user-circle"></i>
                            <span><strong>مقدم الطلب:</strong> ${request.users ? request.users.name : 'غير معروف'}</span>
                        </div>
                    </div>
                    <div class="request-main-details">${detailsHtml}</div>
                </div>
                <div class="review-request-footer">
                    <button class="btn btn-success request-action-button" data-approval-stage="ops_escalate" data-action="approve" data-request-id="${request.id}">
                        <i class="ph-bold ph-arrow-fat-up"></i>اعتماد 
                    </button>
                    <button class="btn btn-danger request-action-button" data-approval-stage="ops_escalate" data-action="reject" data-request-id="${request.id}">
                        <i class="ph-bold ph-x-circle"></i> رفض مباشر
                    </button>
                </div>
            </div>`;
        container.insertAdjacentHTML('beforeend', cardHtml);
    });
}
// ==========================================================
// ===    نهاية الاستبدال الكامل للدالة    ===
// ==========================================================
// نهاية الاستبدال
// بداية الإضافة
// ==========================================================
// ===   بداية الاستبدال الكامل لدالة loadOpsDirectivesPage   ===
// ==========================================================
async function loadOpsDirectivesPage() {
    const container = document.getElementById('ops-users-list-container');
    if (!container || !currentUser) return;
    container.innerHTML = '<p style="text-align: center;">جاري تحميل قائمة الموظفين...</p>';

    // --- هنا التصحيح: تم تغيير الفلترة من project إلى region ---
    const { data: users, error } = await supabaseClient
        .from('users')
        .select('id, name, role, location')
        .eq('region', currentUser.region) // <-- الفلترة الصحيحة حسب المنطقة
        .or('role.eq.مشرف,role.eq.حارس أمن');

    if (error) {
        container.innerHTML = '<p style="text-align: center; color: red;">حدث خطأ في جلب الموظفين.</p>';
        return console.error(error);
    }
    
    if (users.length === 0) {
        container.innerHTML = '<p style="text-align: center;">لا يوجد مشرفون أو حراس في منطقتك حالياً.</p>';
        return;
    }

    container.innerHTML = '';
    users.forEach(user => {
        const userCard = `
            <div class="attendance-card">
                <div>
                    <span>${user.name}</span>
                    <p class="time">${user.role} - ${user.location || 'غير محدد'}</p>
                </div>
                <button class="btn btn-primary open-directive-modal-btn" data-recipient-id="${user.id}" data-recipient-name="${user.name}">
                    <i class="ph-bold ph-paper-plane-tilt"></i> إرسال توجيه
                </button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', userCard);
    });
}
// ==========================================================
// ===    نهاية الاستبدال الكامل للدالة    ===
// ==========================================================
// نهاية الإضافة
// بداية الاستبدال: دالة عرض الحضور لمدير العمليات (مع التحقق من الجداول)
// دالة عرض الحضور (النسخة الجديدة مع عرض حالة الانسحاب)
// ==========================================================
// ===   بداية الاستبدال الكامل لدالة loadGuardAttendancePage   ===
// ==========================================================
async function loadGuardAttendancePage() {
    const container = document.getElementById('guard-attendance-container');
    container.innerHTML = '<p style="text-align: center;">جاري تحميل بيانات الفريق...</p>';
    
    console.log("--- Diagnostic: Starting loadGuardAttendancePage ---");
    
    if (!currentUser || !['ادارة العمليات', 'مشرف', 'مدير النظام'].includes(currentUser.role)) {
        console.error("Diagnostic: User not logged in or doesn't have the correct role.");
        return;
    }
    
    console.log("Diagnostic: Current user object:", currentUser);

    try {
        let guards = [];
        let queryError = null;

        let query = supabaseClient
            .from('users')
            .select('id, name, project, location, region, city, employment_status, job_vacancies!users_vacancy_id_fkey(schedule_details)')
            .eq('role', 'حارس أمن')
            .in('employment_status', ['اساسي', 'تغطية']); 

        if (currentUser.role === 'مشرف') {
            console.log("Diagnostic: Applying filter for 'مشرف'.");
            query = createProjectFilter(query, currentUser.project, 'project');
        } else if (currentUser.role === 'ادارة العمليات') {
            console.log("Diagnostic: Applying filter for 'ادارة العمليات'.");
            query = query.eq('region', currentUser.region);
        }
        
        console.log("Diagnostic: Final query before execution:", query);

        const { data, error } = await query;
        guards = data;
        queryError = error;
        
        if (queryError) throw queryError;
        
        console.log("Diagnostic: Data returned from Supabase for guards:", guards);

        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: attendanceRecords, error: e2 } = await supabaseClient.from('attendance').select('guard_id, created_at, status').gte('created_at', yesterday);
        if (e2) throw e2;

        if (!guards || guards.length === 0) {
            container.innerHTML = '<p style="text-align: center;">لا يوجد حراس أمن في نطاق صلاحياتك حالياً.</p>';
            console.warn("Diagnostic: No guards found after query execution.");
            return;
        }

        // ... (باقي الكود يبقى كما هو)
        const now = new Date();
        const currentDay = now.toLocaleString('en-US', { weekday: 'short' });
        const isAdmin = currentUser.role === 'مدير النظام';
        let guardsStatusHtml = '';

        for (const guard of guards) {
            const isCoverageGuard = guard.employment_status === 'تغطية';
            const shift = guard.job_vacancies?.schedule_details?.[0];
            let status = { text: 'في راحة', class: 'off' };
            let actionButton = '';
            let adminEditButton = '';

            if (isAdmin) {
                adminEditButton = `<button class="btn btn-secondary btn-sm admin-manual-attendance-btn" data-guard-id="${guard.id}" data-guard-name="${guard.name}" title="تعديل يدوي"><i class="ph-bold ph-pencil-simple"></i></button>`;
            }

            const latestAttendance = attendanceRecords.filter(r => r.guard_id === guard.id).sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];

            if (isCoverageGuard) {
                status.text = "تغطية";
                 if (latestAttendance && latestAttendance.status === 'حاضر') {
                    const checkInTime = new Date(latestAttendance.created_at).toLocaleTimeString('ar-SA', { timeStyle: 'short' });
                    status.text = `حاضر (تغطية)`;
                    status.class = 'present';
                }
            } else if (shift && shift.days && shift.days.includes(currentDay)) {
                 if (latestAttendance && latestAttendance.status !== 'اكمل المناوبة') {
                    const checkInTime = new Date(latestAttendance.created_at).toLocaleTimeString('ar-SA', { timeStyle: 'short' });
                    if (latestAttendance.status === 'حاضر') {
                        status = { text: `حاضر (منذ ${checkInTime})`, class: 'present' };
                        actionButton = `<button class="btn btn-secondary btn-sm view-on-map-btn" data-guard-id="${guard.id}" title="عرض في الخريطة"><i class="ph-bold ph-map-pin-line"></i></button>`;
                    } else if (latestAttendance.status === 'انسحاب') {
                        status = { text: `منسحب (منذ ${checkInTime})`, class: 'absent' };
                        if (currentUser.role === 'ادارة العمليات' || currentUser.role === 'مشرف') {
                            const shiftData = { project: guard.project, location: guard.location, region: guard.region, city: guard.city, ...shift };
                            actionButton = `<button class="btn btn-secondary btn-sm add-to-coverage-btn" data-shift='${JSON.stringify(shiftData)}'><i class="ph-bold ph-plus"></i> للتغطية</button>`;
                        }
                    }
                } else {
                    const startTime = new Date(now);
                    const [startHours, startMinutes] = shift.start_time.split(':');
                    startTime.setHours(startHours, startMinutes, 0, 0);
                    if (now >= startTime) {
                        status = { text: 'لم يحضر (غياب)', class: 'absent' };
                        if (currentUser.role === 'ادارة العمليات' || currentUser.role === 'مشرف') {
                            const shiftData = { project: guard.project, location: guard.location, region: guard.region, city: guard.city, ...shift };
                            actionButton = `<button class="btn btn-secondary btn-sm add-to-coverage-btn" data-shift='${JSON.stringify(shiftData)}'><i class="ph-bold ph-plus"></i> للتغطية</button>`;
                        }
                    } else {
                        status.text = 'وردية قادمة';
                    }
                }
            }
            
            const projectDisplay = (Array.isArray(guard.project)) ? guard.project.join(', ') : guard.project;
            const directiveButton = `<button class="btn btn-secondary btn-sm open-directive-modal-btn" data-recipient-id="${guard.id}" data-recipient-name="${guard.name}" title="إرسال توجيه"><i class="ph-bold ph-paper-plane-tilt"></i></button>`;
            guardsStatusHtml += `<div class="attendance-card ${status.class}"><div><span>${guard.name}</span><p class="time">${projectDisplay || ''} / ${guard.location || ''}</p></div><div style="display: flex; align-items: center; gap: 10px;"><span class="status-text">${status.text}</span>${actionButton}${directiveButton}${adminEditButton}</div></div>`;
        }
        container.innerHTML = `<div class="attendance-list">${guardsStatusHtml}</div>`;
    } catch (err) {
        container.innerHTML = `<p style="color: red;">حدث خطأ: ${err.message}</p>`;
        console.error("Diagnostic: Guard Attendance Error:", err);
    }
}
// ==========================================================
// ===    نهاية الاستبدال الكامل لدالة loadGuardAttendancePage    ===
// ==========================================================
// نهاية الاستبدال
// ========= بداية الاستبدال الكامل للدالة (مع رابط الشعار المحدث) =========
async function exportPayrollDataToCsv(data, filename) {
    if (data.length === 0) {
        return alert('لا توجد بيانات للتصدير.');
    }

    // 1. إنشاء مصنف العمل وورقة العمل
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('مسير رواتب', {
        views: [{ rightToLeft: true }] // جعل الورقة تبدأ من اليمين لليسار
    });

    // 2. إضافة الشعار كخلفية شفافة (علامة مائية)
    // !! تم تحديث رابط الشعار هنا !!
    const logoUrl = 'https://i.imgur.com/WTIY72K.png';

    try {
        const response = await fetch(logoUrl);
        const imageBuffer = await response.arrayBuffer();
        const imageId = workbook.addImage({
            buffer: imageBuffer,
            extension: 'png',
        });

        worksheet.addBackgroundImage(imageId);
    } catch (e) {
        console.error("لا يمكن تحميل الشعار. تأكد من أن الرابط صحيح ومتاح للعامة.", e);
    }

    // 3. إعدادات التنسيق المتقدمة
    const headerStyle = {
        font: { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: { bottom: { style: 'medium', color: { argb: 'FF000000' } } }
    };
    const cellStyle = { font: { name: 'Arial', size: 10 }, alignment: { horizontal: 'center', vertical: 'middle' } };
    const moneyStyle = { ...cellStyle, numFmt: '#,##0.00 "ر.س"' };
    const totalStyle = { ...moneyStyle, font: { ...cellStyle.font, bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } } };

    // 4. تعديل البيانات ومعالجة نوع الموظف
    const processedData = data.map(row => {
        const employeeType = row['المسمى الوظيفي'] === 'حارس بديل' ? 'بديل' : 'اساسي';
        return { ...row, "حالة الموظف": employeeType };
    });

    // 5. تحديد وترتيب الأعمدة
    worksheet.columns = Object.keys(processedData[0]).map(key => ({
        header: key,
        key: key,
        width: 18,
        style: cellStyle
    }));

    // 6. إضافة البيانات وتطبيق التنسيقات
    worksheet.addRows(processedData);

    const nonMoneyColumns = ['ايام العمل', 'ساعات العمل', 'راحة', 'ايام الغياب'];

    worksheet.eachRow({ includeEmpty: false }, function(row, rowNumber) {
        row.height = 25;
        row.eachCell({ includeEmpty: true }, function(cell, colNumber) {
            if (rowNumber === 1) {
                cell.style = headerStyle;
                return;
            }

            const key = worksheet.getColumn(colNumber).key;
            if (key === 'اجمالي الراتب' || key === 'مجموع الاستقطاعات' || key === 'الصافي') {
                cell.style = totalStyle;
            }
            
            if (typeof cell.value === 'number' && !nonMoneyColumns.includes(key)) {
                cell.numFmt = moneyStyle.numFmt;
            }
        });
    });

    // 7. إنشاء الملف وتنزيله
    workbook.xlsx.writeBuffer().then(function(buffer) {
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename.replace('.csv', '.xlsx');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}
// ========= نهاية الاستبدال الكامل للدالة =========
// بداية الاستبدال

// --- دوال خاصة بلوحة تحكم مدير النظام ---

// الدالة الرئيسية لتحميل وعرض بيانات لوحة التحكم
async function loadAdminDashboardPage() {
    // إضافة حاوية جديدة للجدول لتجنب استبدال الفلاتر
    if (!document.getElementById('admin-audit-log-table-container')) {
        document.getElementById('admin-audit-log').innerHTML += '<div id="admin-audit-log-table-container"></div>';
        document.getElementById('admin-feedback').innerHTML += '<div id="admin-feedback-container"></div>';
        document.getElementById('admin-error-log').innerHTML += '<div id="admin-error-log-table-container"></div>';
    }

    // تحميل بيانات التبويب الأول (سجل الأحداث) بشكل افتراضي
    loadAuditLogs();

    // إضافة مستمع للنقرات على زر البحث والتبويبات
    const adminPage = document.getElementById('page-admin-dashboard');
    adminPage.addEventListener('click', (event) => {
        event.preventDefault();
        const target = event.target;
        
        // زر البحث
        if (target.closest('#audit-search-btn')) {
            const filters = {
                searchTerm: document.getElementById('audit-search-input').value,
                actionType: document.getElementById('audit-action-filter').value,
                role: document.getElementById('audit-role-filter').value
            };
            loadAuditLogs(filters);
        }

        // التبويبات
        const tabLink = target.closest('.tab-link');
        if (tabLink) {
            adminPage.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
            tabLink.classList.add('active');
            
            const targetTabId = tabLink.dataset.tab;
            adminPage.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(targetTabId)?.classList.add('active');

            if (targetTabId === 'admin-audit-log') loadAuditLogs();
            if (targetTabId === 'admin-feedback') loadFeedback();
            if (targetTabId === 'admin-error-log') loadErrorLogs();
        }
        
        // زر تحديث حالة الشكوى
        const updateFeedbackBtn = target.closest('.update-feedback-status');
        if(updateFeedbackBtn){
             // ... (هذا الكود موجود عندك بالفعل، اتركه كما هو)
        }
    });// الدالة الكاملة والنهائية لتحميل وعرض بيانات لوحة التحكم
async function loadAdminDashboardPage() {
    // تحميل بيانات التبويب الأول (سجل الأحداث) بشكل افتراضي
    loadAuditLogs();

    const adminPage = document.getElementById('page-admin-dashboard');
    
    // استخدام متغير للتأكد من أن مستمع الأوامر يضاف مرة واحدة فقط
    if (!adminPage.dataset.listenerAttached) {
        adminPage.addEventListener('click', async (event) => {
            const target = event.target;
            
            // زر البحث في سجل الأحداث
            if (target.closest('#audit-search-btn')) {
                event.preventDefault();
                const filters = {
                    searchTerm: document.getElementById('audit-search-input').value,
                    actionType: document.getElementById('audit-action-filter').value,
                    role: document.getElementById('audit-role-filter').value
                };
                loadAuditLogs(filters);
            }

            // التبويبات
            const tabLink = target.closest('.tab-link');
            if (tabLink) {
                event.preventDefault();
                adminPage.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
                tabLink.classList.add('active');
                
                const targetTabId = tabLink.dataset.tab;
                adminPage.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                document.getElementById(targetTabId)?.classList.add('active');

                if (targetTabId === 'admin-audit-log') loadAuditLogs();
                if (targetTabId === 'admin-feedback') loadFeedback();
                if (targetTabId === 'admin-error-log') loadErrorLogs();
            }
            
            // --- هنا منطق تحديث حالة الشكوى ---
            const updateFeedbackBtn = target.closest('.update-feedback-status');
            if (updateFeedbackBtn) {
                event.preventDefault();
                const feedbackId = updateFeedbackBtn.dataset.id;
                const newStatus = updateFeedbackBtn.dataset.status;

                if (confirm(`هل أنت متأكد من تغيير حالة الرسالة إلى "${newStatus}"؟`)) {
                    updateFeedbackBtn.disabled = true;
                    updateFeedbackBtn.textContent = 'جاري...';
                    
                    const { error } = await supabaseClient
                        .from('feedback')
                        .update({ status: newStatus })
                        .eq('id', feedbackId);

                    if (error) {
                        alert('حدث خطأ أثناء تحديث الحالة.');
                        console.error('Update feedback error:', error);
                    } else {
                        alert('تم تحديث الحالة بنجاح.');
                        loadFeedback(); // إعادة تحميل قائمة الشكاوى لتحديث الواجهة
                    }
                }
            }
        });

        // وضع علامة بأن المستمع قد تم إضافته
        adminPage.dataset.listenerAttached = 'true';
    }
}
}

// دالة لجلب وعرض الاحتياجات التي لم يتم تغطيتها
async function loadUncoveredNeeds() {
    const container = document.getElementById('uncovered-needs-list');
    if (!container || !currentUser) return;
    container.innerHTML = '<p style="text-align: center;">جاري تحليل الجداول...</p>';

    try {
        let query = supabaseClient.from('users').select('id, name, project, location, region, city, job_vacancies!users_vacancy_id_fkey!inner(schedule_details)').eq('role', 'حارس أمن').eq('employment_status', 'اساسي');
        if (currentUser.role === 'ادارة العمليات') query = query.eq('region', currentUser.region);
        else if (currentUser.role === 'مشرف') query = createProjectFilter(query, currentUser.project);

        const { data: guards, error: e1 } = await query;
        if (e1) throw e1;

        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: attendanceRecords, error: e2 } = await supabaseClient.from('attendance').select('guard_id, status').gte('created_at', yesterday);
        if (e2) throw e2;

        // --- الخطوة الجديدة: جلب الحراس الذين تم إنشاء تغطية لهم بالفعل ---
        const { data: coveredShifts, error: e3 } = await supabaseClient.from('coverage_shifts').select('covered_user_id').not('covered_user_id', 'is', null);
        if (e3) throw e3;
        const coveredGuardIds = new Set(coveredShifts.map(s => s.covered_user_id));
        // --- نهاية الخطوة الجديدة ---

        const now = new Date();
        const currentDay = now.toLocaleString('en-US', { weekday: 'short' });
        const uncoveredGuards = [];

        for (const guard of guards) {
            // --- هنا التعديل: التأكد من أن الحارس لم يتم تغطيته بعد ---
            if (coveredGuardIds.has(guard.id)) {
                continue; // تخطي هذا الحارس لأنه مغطى بالفعل
            }

            const shift = guard.job_vacancies?.schedule_details?.[0];
            if (shift && shift.days && shift.days.includes(currentDay)) {
                const latestAttendance = attendanceRecords.find(r => r.guard_id === guard.id);
                if (!latestAttendance || (latestAttendance.status !== 'حاضر' && latestAttendance.status !== 'اكمل المناوبة')) {
                    const startTime = new Date(now);
                    const [startHours, startMinutes] = shift.start_time.split(':');
                    startTime.setHours(startHours, startMinutes, 0, 0);
                    if (now >= startTime) {
                        uncoveredGuards.push({ guard, shift });
                    }
                }
            }
        }

        if (uncoveredGuards.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 20px;">لا يوجد غياب أو نقص حالياً.</p>';
            return;
        }

        container.innerHTML = '';
        uncoveredGuards.forEach(({ guard, shift }) => {
            const shiftData = { project: guard.project, location: guard.location, region: guard.region, city: guard.city, ...shift, absent_guard_id: guard.id };
            const cardHtml = `
                <div class="hiring-card" style="border-left: 4px solid var(--denied-color);">
                    <div class="hiring-card-header">
                        <h5>${guard.name} (غياب)</h5>
                        <button class="btn btn-secondary btn-sm add-to-coverage-btn" data-shift='${JSON.stringify(shiftData)}'>
                            <i class="ph-bold ph-plus"></i> إنشاء تغطية
                        </button>
                    </div>
                    <p><i class="ph-bold ph-map-pin"></i> ${Array.isArray(guard.project) ? guard.project.join('') : guard.project} - ${guard.location}</p>
                    <p><i class="ph-bold ph-clock"></i> ${formatTimeAMPM(shift.start_time)} - ${formatTimeAMPM(shift.end_time)}</p>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', cardHtml);
        });

    } catch (err) {
        container.innerHTML = `<p style="color: red;">حدث خطأ: ${err.message}</p>`;
        console.error("Uncovered Needs Error:", err);
    }
}
// دالة لجلب وعرض سجل الأحداث مع الفلترة
async function loadAuditLogs(filters = {}) {
    const container = document.getElementById('admin-audit-log-table-container'); // حاوية الجدول الجديدة
    container.innerHTML = '<p style="text-align: center;">جاري تحميل سجل الأحداث...</p>';

    try {
        let query = supabaseClient
            .from('audit_logs')
            .select(`*, users:users!audit_logs_user_id_fkey(role)`) // جلب الدور من جدول المستخدمين
            .order('created_at', { ascending: false })
            .limit(100);

        // تطبيق الفلاتر
        if (filters.searchTerm) {
            query = query.or(`user_name.ilike.%${filters.searchTerm}%,details->>id_number.ilike.%${filters.searchTerm}%`);
        }
        if (filters.actionType) {
            query = query.eq('action_type', filters.actionType);
        }
        if (filters.role) {
            query = query.eq('users.role', filters.role);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (data.length === 0) return container.innerHTML = '<p>لا توجد نتائج تطابق بحثك.</p>';

        container.innerHTML = `
            <div class="table-container"><table>
                <thead><tr><th>الوقت والتاريخ</th><th>اسم المستخدم</th><th>دوره</th><th>الإجراء</th><th>تفاصيل</th></tr></thead>
                <tbody>
                    ${data.map(log => `
                        <tr>
                            <td>${new Date(log.created_at).toLocaleString('ar-SA')}</td>
                            <td>${log.user_name || 'نظام'}</td>
                            <td>${log.users?.role || 'غير محدد'}</td>
                            <td><span class="status pending">${log.action_type}</span></td>
                            <td>${JSON.stringify(log.details)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table></div>`;
    } catch(err) {
        container.innerHTML = `<p style="color:red;">حدث خطأ: ${err.message}</p>`;
        console.error("Audit Log Error:", err);
    }
}

// دالة لجلب وعرض الشكاوى والاقتراحات
async function loadFeedback() {
    const container = document.getElementById('admin-feedback');
    container.innerHTML = '<p style="text-align: center;">جاري تحميل الشكاوى والاقتراحات...</p>';
    const { data, error } = await supabaseClient.from('feedback').select('*').order('created_at', { ascending: false });
    if (error) return container.innerHTML = `<p style="color:red;">${error.message}</p>`;
    if (data.length === 0) return container.innerHTML = '<p>لا توجد رسائل جديدة.</p>';

    container.innerHTML = `<div class="all-requests-container">${data.map(fb => `
        <div class="review-request-card">
            <div class="review-request-header ${fb.status === 'تم الحل' ? 'status-approved' : 'status-pending'}">
                <h4>${fb.feedback_type} من: ${fb.user_name || 'زائر'}</h4>
                <span class="status-badge">${fb.status}</span>
            </div>
            <div class="review-request-body"><p>${fb.content}</p></div>
            ${fb.status === 'جديدة' ? `
            <div class="review-request-footer">
                <button class="btn btn-primary btn-sm update-feedback-status" data-id="${fb.id}" data-status="تم الحل">
                    <i class="ph-bold ph-check-circle"></i> تحديد كـ "تم الحل"
                </button>
            </div>` : ''}
        </div>
    `).join('')}</div>`;
}

// دالة لجلب وعرض سجل الأخطاء
async function loadErrorLogs() {
    const container = document.getElementById('admin-error-log');
    container.innerHTML = '<p style="text-align: center;">جاري تحميل سجل الأخطاء...</p>';
    const { data, error } = await supabaseClient.from('error_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) return container.innerHTML = `<p style="color:red;">${error.message}</p>`;
    if (data.length === 0) return container.innerHTML = '<p>لا توجد أخطاء مسجلة. هذا شيء جيد!</p>';
    
    container.innerHTML = `
        <div class="table-container"><table>
            <thead><tr><th>وقت الخطأ</th><th>المستخدم</th><th>رسالة الخطأ</th></tr></thead>
            <tbody>
                ${data.map(log => `
                    <tr style="color: var(--denied-color);">
                        <td>${new Date(log.created_at).toLocaleString('ar-SA')}</td>
                        <td>${log.user_name || 'غير معروف'}</td>
                        <td>${log.error_message}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table></div>`;
}
// دالة تحميل صفحة الجولة (النسخة الجديدة المعتمدة على جدول patrols)
async function loadSupervisorPatrolPage() {
    const page = document.getElementById('page-patrol');
    if (!page) return;

    const statusText = page.querySelector('#patrol-status');
    const startBtn = page.querySelector('#start-patrol-btn');
    const endBtn = page.querySelector('#end-patrol-btn');

    statusText.innerHTML = '<p>جاري التحقق من حالة الجولة...</p>';
    startBtn.classList.add('hidden');
    endBtn.classList.add('hidden');

    // --- بداية التصحيح ---
    const { data, error } = await supabaseClient
        .from('patrols')
        .select('id, start_time')
        .eq('supervisor_id', currentUser.id)
        .eq('status', 'active')
        .limit(1);
    // --- نهاية التصحيح ---

    if (error) {
        statusText.innerHTML = '<p>حدث خطأ أثناء التحقق من حالتك.</p>';
        return console.error(error);
    }

    const activePatrol = data && data.length > 0 ? data[0] : null;

    if (activePatrol) {
        const startTime = new Date(activePatrol.start_time).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
        statusText.innerHTML = `<p>أنت حالياً في جولة ميدانية بدأت الساعة <strong>${startTime}</strong>.</p>`;
        endBtn.dataset.patrolId = activePatrol.id;
        endBtn.classList.remove('hidden');
        startPatrolTracking(activePatrol.id);
    } else {
        statusText.innerHTML = `<p>أنت لست في جولة حالياً. اضغط على "بدء الجولة" لتسجيل جولة جديدة.</p>`;
        startBtn.classList.remove('hidden');
    }
}
// نهاية الاستبدال

// بداية الإضافة: دالة تحميل صفحة الشواغر
async function loadVacanciesPage() {
    const listContainer = document.getElementById('vacancies-list-container');
    listContainer.innerHTML = '<p style="text-align: center;">جاري حساب الإحصائيات وتحميل الشواغر...</p>';

    // --- 1. حساب الإحصائيات ---
    let totalRequired = 0;
    const { data: contracts } = await supabaseClient.from('contracts').select('locations_and_guards').eq('status', 'active');
    if (contracts) {
        contracts.forEach(contract => {
            if (contract.locations_and_guards) {
                contract.locations_and_guards.forEach(location => {
                    if(location.shifts) {
                        location.shifts.forEach(shift => {
                            totalRequired += parseInt(shift.guards_count) || 0;
                        });
                    }
                });
            }
        });
    }

    const { count: assignedEmployees } = await supabaseClient.from('users').select('*', { count: 'exact', head: true }).not('contract_id', 'is', null);

    document.getElementById('hr-stats-required').textContent = totalRequired;
    document.getElementById('hr-stats-assigned').textContent = assignedEmployees || 0;
    document.getElementById('hr-stats-gap').textContent = totalRequired - (assignedEmployees || 0);

    // --- 2. جلب وعرض الشواغر الحالية ---
    // (ملاحظة: جدول الشواغر لديك اسمه job_vacancies)
    const { data: vacancies, error } = await supabaseClient.from('job_vacancies').select('*, contracts(company_name)');

    if (error) {
        console.error('Error fetching vacancies:', error);
        listContainer.innerHTML = '<p class="text-center text-red-500">حدث خطأ في تحميل الشواغر.</p>';
        return;
    }

    if (vacancies.length === 0) {
        listContainer.innerHTML = '<p style="text-align: center;">لا توجد شواغر مضافة حالياً.</p>';
        return;
    }

    listContainer.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>المسمى الوظيفي</th>
                    <th>المشروع</th>
                    <th>تابع لعقد</th>
                    <th>الحالة</th>
                    <th>إجراءات</th>
                </tr>
            </thead>
            <tbody>
                ${vacancies.map(vacancy => `
                    <tr>
                        <td>${vacancy.title}</td>
                        <td>${vacancy.project || 'غير محدد'}</td>
                        <td>${vacancy.contracts ? vacancy.contracts.company_name : 'غير تابع لعقد'}</td>
                        <td><span class="status ${vacancy.status === 'open' ? 'active' : 'inactive'}">${vacancy.status === 'open' ? 'مفتوح' : 'مغلق'}</span></td>
                        <td>
                            <button class="btn-action edit-vacancy-btn" data-id="${vacancy.id}"><i class="ph-bold ph-pencil-simple"></i></button>
                            <button class="btn-action delete-vacancy-btn" data-id="${vacancy.id}"><i class="ph-bold ph-trash"></i></button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}
// نهاية الإضافة
// بداية الاستبدال للدوال المساعدة
function createShiftGroupHtml(shift = {}) {
    const guardsCount = shift.guards_count || 1;
    const startTime = shift.start_time || '';
    const endTime = shift.end_time || '';
    const days = shift.days || [];
    
    const dayNames = {Sat: 'السبت', Sun: 'الأحد', Mon: 'الاثنين', Tue: 'الثلاثاء', Wed: 'الأربعاء', Thu: 'الخميس', Fri: 'الجمعة'};
    const daysHtml = Object.keys(dayNames).map(dayKey => {
        const isChecked = days.includes(dayKey) ? 'checked' : '';
        return `<label><input type="checkbox" value="${dayKey}" ${isChecked}>${dayNames[dayKey]}</label>`;
    }).join('');

    return `
        <div class="shift-group">
            <div class="form-group">
                <label>عدد الحراس لهذه الوردية</label>
                <input type="number" class="shift-guards-input" value="${guardsCount}" min="1" style="width: 150px;">
            </div>
            <div class="form-group" style="flex-grow:1;">
                <label>أيام عمل الوردية:</label>
                <div class="weekdays-selector">${daysHtml}</div>
            </div>
            <div class="form-group">
                <label>من:</label>
                <input type="time" class="shift-start-time-input" value="${startTime}">
            </div>
            <div class="form-group">
                <label>إلى:</label>
                <input type="time" class="shift-end-time-input" value="${endTime}">
            </div>
            <button class="delete-btn delete-shift-btn" title="حذف الوردية"><i class="ph-bold ph-x"></i></button>
        </div>
    `;
}

function createLocationGroupHtml(location = {}) {
    const locationName = location.location_name || '';
    const shifts = location.shifts && location.shifts.length > 0 ? location.shifts : [{}];
    const shiftsHtml = shifts.map(shift => createShiftGroupHtml(shift)).join('');
    
    return `
        <div class="location-group">
            <div class="location-group-header">
                <div class="form-group" style="flex-grow:1;">
                    <label>اسم الموقع (الفرع)</label>
                    <input type="text" class="location-name-input" value="${locationName}" placeholder="مثال: فرع غرناطة">
                </div>
                <button class="delete-btn delete-location-btn" title="حذف الموقع"><i class="ph-bold ph-trash"></i></button>
            </div>
            <div class="shifts-section">
                <h6>ورديات هذا الموقع:</h6>
                <div class="shifts-container">${shiftsHtml}</div>
                <button class="btn btn-secondary btn-sm add-shift-btn" style="margin-top:10px;">
                    <i class="ph-bold ph-plus-circle"></i> إضافة وردية أخرى لهذا الموقع
                </button>
            </div>
        </div>
    `;
}
// نهاية الاستبدال

function loadMyProfilePage() {
    // هذه الدالة فارغة حالياً لأن الصفحة لا تحتاج لتحميل أي بيانات ديناميكية
    // يمكننا إضافة منطق لها في المستقبل إذا احتجنا لذلك
    console.log("My Profile page loaded.");
}

// ===================== نهاية الإضافة =====================
// بداية الاستبدال
async function loadPermissionRequests() {
    const container = document.getElementById('permission-requests-container');
    container.innerHTML = '<p style="text-align: center;">جاري تحميل الطلبات...</p>';

    const { data: requests, error } = await supabaseClient
        .from('employee_requests')
        .select(`*, users:user_id(name)`)
        .eq('request_type', 'permission')
        .eq('status', 'بانتظار موافقة العمليات') // <-- التعديل هنا
        .order('created_at', { ascending: false });

    if (error) {
        console.error('خطأ في جلب طلبات الاستئذان:', error);
        container.innerHTML = '<p style="color:red;">حدث خطأ.</p>';
        return;
    }
    if (requests.length === 0) {
        container.innerHTML = '<p style="text-align: center;">لا توجد طلبات استئذان بانتظار الموافقة النهائية.</p>';
        return;
    }

    container.innerHTML = '';
    requests.forEach(request => {
        const cardActions = `
            <button class="btn btn-success request-action-button" data-approval-stage="direct_permission" data-action="approve" data-request-id="${request.id}" data-user-id="${request.user_id}"><i class="ph-bold ph-check"></i> قبول نهائي</button>
            <button class="btn btn-danger request-action-button" data-approval-stage="direct_permission" data-action="reject" data-request-id="${request.id}"><i class="ph-bold ph-x"></i> رفض</button>
        `;
        const card = `
            <div class="request-card" style="border-right-color: #f59e0b;">
                <div class="request-card-header">
                    <h4>طلب من: ${request.users ? request.users.name : 'غير معروف'}</h4>
                    <div class="report-actions">${cardActions}</div>
                </div>
                <div class="request-card-body">
                    <p class="visit-notes"><strong>السبب:</strong> ${request.details.reason || 'لم يحدد سبب.'}</p>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', card);
    });
}
// نهاية الاستبدال

function updateUIVisibility(role) {
    const allMenuItems = document.querySelectorAll('.sidebar-nav li');

    allMenuItems.forEach(item => {
        const allowedRoles = item.dataset.role ? item.dataset.role.split(',') : [];

        // التعديل هنا: تحقق إذا كانت القائمة تحتوي على الدور الحالي أو تحتوي على 'all'
        if (allowedRoles.includes(role) || allowedRoles.includes('all')) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}
// --- الخطوة 8: دالة لجلب وعرض المستخدمين ---
async function fetchUsers() {
    // 1. جلب البيانات من جدول 'users'
    const { data: users, error } = await supabaseClient
        .from('users')
        .select('name, role, last_login, status');

    if (error) {
        console.error('خطأ في جلب المستخدمين:', error);
        return;
    }

    // 2. الوصول إلى جسم الجدول في الصفحة
    const tableBody = document.querySelector('#page-users tbody');

    // 3. مسح أي صفوف قديمة
    tableBody.innerHTML = ''; 

    // 4. التحقق إذا لم يكن هناك مستخدمين
    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">لا يوجد مستخدمين لعرضهم حالياً.</td></tr>';
        return;
    }

    // 5. إضافة صف جديد لكل مستخدم
    users.forEach(user => {
        // تنسيق التاريخ والوقت ليصبح удобочитаемым
        const lastLogin = user.last_login 
            ? new Date(user.last_login).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) 
            : 'لم يسجل الدخول';

        const row = `
            <tr>
                <td>${user.name || 'غير متوفر'}</td>
                <td>${user.role || 'غير محدد'}</td>
                <td>${lastLogin}</td>
                <td>
                    <span class="status ${user.status === 'active' ? 'active' : 'inactive'}">
                        ${user.status === 'active' ? 'نشط' : 'غير نشط'}
                    </span>
                </td>
                <td>
                    <button class="btn-action edit"><i class="ph-bold ph-pencil-simple"></i></button>
                    <button class="btn-action delete"><i class="ph-bold ph-trash"></i></button>
                </td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', row);
    });
}

// دالة لجلب التغطيات المكتملة بانتظار اعتماد العمليات
async function loadCompletedCoveragesForApproval() {
    const container = document.getElementById('coverage-approval-list');
    if (!container || !currentUser) return;
    container.innerHTML = '<p style="text-align: center;">جاري تحميل التغطيات المكتملة...</p>';

    let query = supabaseClient
        .from('coverage_shifts')
        .select(`*, coverage_applicants!inner(full_name), coverage_payments!inner(id)`)
        .eq('status', 'completed_pending_ops_approval');

    if (currentUser.role === 'ادارة العمليات') query = query.eq('region', currentUser.region);

    const { data: shifts, error } = await query;
    if (error) { container.innerHTML = '<p style="color:red">خطأ في جلب البيانات.</p>'; return console.error(error); }
    if (shifts.length === 0) { container.innerHTML = '<p>لا توجد تغطيات مكتملة بانتظار الاعتماد حالياً.</p>'; return; }

    container.innerHTML = shifts.map(shift => `
        <div class="review-request-card">
            <div class="review-request-header status-pending">
                <h4>اعتماد تغطية مكتملة</h4>
            </div>
            <div class="review-request-body">
                <p><strong>الحارس:</strong> ${shift.coverage_applicants[0].full_name}</p>
                <p><strong>المشروع:</strong> ${shift.project} - ${shift.location}</p>
                <p><strong>قيمة التغطية:</strong> ${shift.coverage_pay} ر.س</p>
            </div>
            <div class="review-request-footer">
                <button class="btn btn-success ops-approve-completed-coverage-btn" data-payment-id="${shift.coverage_payments[0].id}">
                    <i class="ph-bold ph-check-circle"></i> اعتماد وإرسال للمالية
                </button>
            </div>
        </div>
    `).join('');
}

// --- دالة لجلب وعرض العقود ---
// بداية الاستبدال لدالة fetchContracts
async function fetchContracts() {
    const listContainer = document.querySelector('#contracts-list-container');
    listContainer.innerHTML = '<p style="text-align: center;">جاري تحميل العقود...</p>';

    const { data: contracts, error } = await supabaseClient
        .from('contracts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('خطأ في جلب العقود:', error);
        listContainer.innerHTML = '<p style="text-align: center; color: red;">حدث خطأ.</p>';
        return;
    }

    if (contracts.length === 0) {
        listContainer.innerHTML = '<p style="text-align: center;">لا توجد عقود مضافة حالياً.</p>';
        return;
    }

    listContainer.innerHTML = '';
    const contractsHtml = contracts.map(contract => {
        // --- حساب إجمالي الحراس من البيانات الجديدة ---
        let totalGuards = 0;
        if (contract.contract_locations && Array.isArray(contract.contract_locations)) {
            contract.contract_locations.forEach(location => {
                if (location.shifts && Array.isArray(location.shifts)) {
                    location.shifts.forEach(shift => {
                        totalGuards += parseInt(shift.guards_count) || 0;
                    });
                }
            });
        }
        
        // ================== بداية الكود الجديد لحساب الأيام المتبقية ==================
        let remainingDaysHtml = '';
        if (contract.end_date) {
            const endDate = new Date(contract.end_date);
            const today = new Date();
            // تجاهل الوقت للمقارنة بين التواريخ فقط
            today.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);

            const diffTime = endDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                remainingDaysHtml = `
                    <div class="info-line" style="color: #ef4444;">
                        <i class="ph-bold ph-warning-circle"></i>
                        <strong>الحالة:</strong> العقد منتهي
                    </div>
                `;
            } else if (diffDays === 0) {
                remainingDaysHtml = `
                    <div class="info-line" style="color: #f59e0b;">
                        <i class="ph-bold ph-hourglass-high"></i>
                        <strong>الحالة:</strong> ينتهي اليوم
                    </div>
                `;
            } else {
                remainingDaysHtml = `
                    <div class="info-line">
                        <i class="ph-bold ph-timer"></i>
                        <strong>المتبقي على الانتهاء:</strong> ${diffDays} يوم
                    </div>
                `;
            }
        } else {
            remainingDaysHtml = `
                <div class="info-line">
                    <i class="ph-bold ph-calendar-x"></i>
                    <strong>المتبقي على الانتهاء:</strong> غير محدد
                </div>
            `;
        }
        // ================== نهاية الكود الجديد ==================

        return `
            <div class="contract-card">
                <div class="contract-card-header"><h4>${contract.company_name}</h4></div>
                <div class="contract-card-body">
                    <div class="info-line">
                        <i class="ph-bold ph-shield-plus"></i>
                        <strong>إجمالي الحراس:</strong> ${totalGuards}
                    </div>
                    ${remainingDaysHtml} 
                </div>
             <div class="contract-card-footer">
                    <button class="btn btn-primary view-contract-btn" data-id="${contract.id}"><i class="ph-bold ph-eye"></i> عرض التفاصيل</button>
                    <button class="btn btn-secondary edit-contract-btn" data-id="${contract.id}"><i class="ph-bold ph-pencil-simple"></i> تعديل</button>
                    <button class="btn btn-danger delete-contract-btn" data-id="${contract.id}"><i class="ph-bold ph-trash"></i> حذف</button>
                </div>
            </div>
        `;
    }).join('');

    listContainer.innerHTML = `<div class="contracts-container">${contractsHtml}</div>`;
}
// نهاية الاستبدال
// ------------------------------------
// ------------------------------------
// --- دالة لبناء واجهة صفحة الحضور للحارس مع التحقق من الحالة (نسخة مصححة) ---
// ==================== بداية الاستبدال ====================
async function loadAttendancePage() {
    const attendanceContent = document.querySelector('#page-attendance');
    attendanceContent.innerHTML = `
        <div class="page-header"><h3>تسجيل الحضور والانصراف</h3></div>
        <div class="attendance-card">
            <div id="attendance-status" class="attendance-status-text"><p>جاري التحقق من حالتك...</p></div>
            <div id="attendance-actions">
                <button id="check-in-btn" class="btn btn-success btn-lg hidden">تسجيل حضور</button>
                <button id="check-out-btn" class="btn btn-danger btn-lg hidden">تسجيل انصراف</button>
            </div>
            <div id="location-status" class="location-status"></div>
        </div>`;

    if (!currentUser) {
        document.getElementById('attendance-status').innerHTML = '<p>الرجاء تسجيل الدخول أولاً.</p>';
        return;
    }

    try {
        const { data: openRecord, error: attendanceError } = await supabaseClient
            .from('attendance')
            .select('id, created_at, status')
            .eq('guard_id', currentUser.id)
            .is('checkout_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (attendanceError && attendanceError.code !== 'PGRST116') {
            throw attendanceError;
        }

        const statusText = document.getElementById('attendance-status');
        const checkInBtn = document.getElementById('check-in-btn');
        const checkOutBtn = document.getElementById('check-out-btn');

        if (openRecord) {
            const clockInTime = new Date(openRecord.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

            if (openRecord.status === 'انسحاب') {
                statusText.innerHTML = `<p style="color: var(--denied-color);">حالتك الحالية: <strong>منسحب</strong>. يرجى التواصل مع مشرفك.</p>`;
                stopPersistentTracking();
            } else {
                statusText.innerHTML = `<p>حالتك الحالية: <strong>مسجل حضور</strong> منذ الساعة ${clockInTime}</p>`;
                checkOutBtn.classList.remove('hidden');
                checkOutBtn.dataset.attendanceId = openRecord.id;

                // --- هنا التعديل المهم: استخدام نفس طريقة جلب البيانات الناجحة ---
                const { data: fullUser, error: userError } = await supabaseClient
                    .from('users')
                    .select('*, job_vacancies:job_vacancies!users_vacancy_id_fkey(*, contracts(*))')
                    .eq('id', currentUser.id)
                    .single();

                if (userError || !fullUser || !fullUser.job_vacancies) {
                    throw new Error('لا يمكن تفعيل التتبع، الموظف غير مرتبط بشاغر.');
                }
                startPersistentTracking(fullUser, openRecord.id);
            }
        } else {
            statusText.innerHTML = `<p>حالتك الحالية: <strong>لم تسجل حضور بعد</strong></p>`;
            checkInBtn.classList.remove('hidden');
            stopPersistentTracking();
        }
    } catch (error) {
        document.getElementById('attendance-status').innerHTML = `<p style="color: var(--denied-color);">${error.message}</p>`;
        console.error("Attendance Page Error:", error);
        stopPersistentTracking();
    }
}
// دالة لجلب وعرض إحصائيات الخريطة
// ==========================================================
// ===   بداية الاستبدال الكامل لدالة loadMapStatistics   ===
// ==========================================================
async function loadMapStatistics() {
    const presentEl = document.getElementById('map-stats-present');
    const scheduledEl = document.getElementById('map-stats-scheduled');
    const coverageEl = document.getElementById('map-stats-coverage');
    const vacanciesEl = document.getElementById('map-stats-vacancies');

    if (!presentEl || !currentUser) return;

    presentEl.textContent = '...';
    scheduledEl.textContent = '...';
    coverageEl.textContent = '...';
    vacanciesEl.textContent = '...';

    try {
        let baseQuery = supabaseClient.from('users').select('id, job_vacancies!users_vacancy_id_fkey(schedule_details)');

        if (currentUser.role === 'ادارة العمليات') {
            baseQuery = baseQuery.eq('region', currentUser.region);
        } else if (currentUser.role === 'مشرف') {
            baseQuery = createProjectFilter(baseQuery, currentUser.project);
        }

        const { data: scheduledUsers, error: e1 } = await baseQuery.eq('role', 'حارس أمن').eq('employment_status', 'اساسي');
        if (e1) throw e1;

        const currentDay = new Date().toLocaleString('en-US', { weekday: 'short' });
        const scheduledTodayUsers = scheduledUsers.filter(user => 
            user.job_vacancies?.schedule_details?.[0]?.days.includes(currentDay)
        );
        scheduledEl.textContent = scheduledTodayUsers.length;
        
        const scheduledTodayIds = scheduledTodayUsers.map(u => u.id);

        if (scheduledTodayIds.length > 0) {
            const { count: presentCount, error: e2 } = await supabaseClient
                .from('attendance')
                .select('*', { count: 'exact', head: true })
                .in('guard_id', scheduledTodayIds)
                .eq('status', 'حاضر');
            if (e2) throw e2;
            presentEl.textContent = presentCount || 0;
        } else {
            presentEl.textContent = 0;
        }

        let coverageQuery = supabaseClient.from('users').select('*', { count: 'exact', head: true }).eq('employment_status', 'تغطية');
        if (currentUser.role === 'ادارة العمليات') coverageQuery = coverageQuery.eq('region', currentUser.region);
        if (currentUser.role === 'مشرف') coverageQuery = createProjectFilter(coverageQuery, currentUser.project);
        const { count: coverageCount, error: e3 } = await coverageQuery;
        if (e3) throw e3;
        coverageEl.textContent = coverageCount || 0;

        let vacancyQuery = supabaseClient.from('job_vacancies').select('*', { count: 'exact', head: true }).eq('status', 'open');
        if (currentUser.role === 'ادارة العمليات') vacancyQuery = vacancyQuery.eq('region', currentUser.region);
        
        // -- بداية التعديل: استخدام طريقة الفلترة الصحيحة للشواغر --
        if (currentUser.role === 'مشرف') {
            // نستخدم .in() للبحث عن المشاريع (لأن عمود المشروع نصي وليس قائمة)
            vacancyQuery = vacancyQuery.in('project', currentUser.project);
        }
        // -- نهاية التعديل --

        const { count: vacancyCount, error: e4 } = await vacancyQuery;
        if (e4) throw e4;
        vacanciesEl.textContent = vacancyCount || 0;

    } catch(error) {
        console.error("Failed to load map statistics:", error);
        presentEl.textContent = 'خطأ';
    }
}
// ==========================================================
// ===    نهاية الاستبدال الكامل لدالة loadMapStatistics    ===
// ==========================================================
// دالة جديدة لبدء التتبع
// ==================== بداية الاستبدال ====================
// دالة جديدة لبدء التتبع
// ==================== بداية الاستبدال ====================
// دالة لبدء التتبع المستمر (النسخة الجديدة مع إرسال إشعارات الانسحاب)
async function startPersistentTracking(fullUser, attendanceId) {
    stopPersistentTracking(); // إيقاف أي مؤقت قديم أولاً

    const locationStatus = document.getElementById('location-status');
    if (locationStatus) locationStatus.innerHTML = `<p style="color: #22c55e;">التتبع المباشر فعال.</p>`;

    // يمكنك تغيير هذا الرقم. 30000 تعني 30 ثانية.
    const UPDATE_INTERVAL_MS = 15000;

    const handleTrackingError = (geoError) => {
        console.error("خطأ في التتبع المستمر:", geoError);
        stopPersistentTracking();
        const message = 'توقف التتبع بسبب خطأ في تحديد الموقع.';
        if (locationStatus) locationStatus.innerHTML = `<p style="color: #dc3545;">${message}</p>`;
    };

    try {
        const vacancy = fullUser.job_vacancies;
        const contract = vacancy.contracts;
        if (!contract) throw new Error('لا يمكن العثور على بيانات العقد.');

        const locationData = contract.contract_locations.find(loc => loc.name === vacancy.specific_location);
        if (!locationData || !locationData.geofence_link) throw new Error('لم يتم تحديد إحداثيات الموقع في العقد.');

        const siteCoords = parseCoordinates(locationData.geofence_link);
        const radius = locationData.geofence_radius || 200;
        if (!siteCoords) throw new Error('إحداثيات الموقع في العقد غير صالحة.');

        // دالة ليتم استدعاؤها بشكل دوري
        const updateLocation = () => {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    // تحديث الموقع الحالي في جدول المواقع المباشرة
                    supabaseClient.from('guard_locations').upsert({ guard_id: fullUser.id, latitude, longitude }, { onConflict: 'guard_id' }).then();
                    
                    const distance = calculateDistance(siteCoords, { lat: latitude, lng: longitude });

                    if (distance > radius) {
                        stopPersistentTracking();
                        showToast(`تم تسجيل انسحاب للحارس: ${fullUser.name}`, 'error');
                        await supabaseClient.from('attendance').update({ status: 'انسحاب', checkout_at: new Date() }).eq('id', attendanceId);
                        loadAttendancePage();
                    }
                },
                handleTrackingError,
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        };

        // قم بتشغيل الدالة مرة واحدة فوراً
        updateLocation();

        // ثم قم بتعيينها لتعمل كل فترة زمنية محددة
        locationUpdateInterval = setInterval(updateLocation, UPDATE_INTERVAL_MS);

    } catch(err) {
        console.error("فشل بدء التتبع:", err.message);
        if (locationStatus) locationStatus.innerHTML = `<p style="color: #dc3545;">${err.message}</p>`;
    }
}
// ===================== نهاية الاستبدال =====================
// ===================== نهاية الاستبدال =====================

// دالة جديدة لإيقاف التتبع
let locationUpdateInterval = null;

function stopPersistentTracking() {
    if (locationUpdateInterval) {
        clearInterval(locationUpdateInterval); // نستخدم clearInterval بدلاً من clearWatch
        locationUpdateInterval = null;
        const locationStatus = document.getElementById('location-status');
        if (locationStatus) locationStatus.innerHTML = '';
        console.log('تم إيقاف التتبع المباشر.');
    }
}
// ===================== نهاية الاستبدال =====================

// --- الخطوة 11: دالة لجلب وعرض الوظائف ---
async function fetchJobs() {
    const { data: jobs, error } = await supabaseClient
        .from('jobs')
        .select('title, location, type, status'); // نحدد الأعمدة المطلوبة

    if (error) {
        console.error('خطأ في جلب الوظائف:', error);
        const jobsContent = document.querySelector('#page-jobs');
        jobsContent.innerHTML = '<p style="text-align: center;">حدث خطأ أثناء تحميل الوظائف.</p>';
        return;
    }

    const jobsContent = document.querySelector('#page-jobs');
    // مسح المحتوى المؤقت "محتوى صفحة الوظائف هنا"
    jobsContent.innerHTML = '';

    if (jobs.length === 0) {
        jobsContent.innerHTML = '<p style="text-align: center;">لا توجد وظائف متاحة حالياً.</p>';
        return;
    }

    // إنشاء حاوية للبطاقات
    const jobsContainer = document.createElement('div');
    jobsContainer.className = 'jobs-container';

    jobs.forEach(job => {
        const card = `
            <div class="job-card">
                <div class="job-card-header">
                    <h3>${job.title || 'بدون عنوان'}</h3>
                    <span class="status ${job.status === 'active' ? 'active' : 'inactive'}">${job.status === 'active' ? 'شاغرة' : 'مغلقة'}</span>
                </div>
                <div class="job-card-body">
                    <p><i class="ph-bold ph-map-pin"></i> ${job.location || 'غير محدد'}</p>
                    <p><i class="ph-bold ph-clock"></i> ${job.type || 'غير محدد'}</p>
                </div>
                <div class="job-card-footer">
                    <button class="btn btn-secondary">عرض التفاصيل</button>
                </div>
            </div>
        `;
        jobsContainer.insertAdjacentHTML('beforeend', card);
    });

    jobsContent.appendChild(jobsContainer);
}
// ------------------------------------
// دالة لصفحة إدارة المستخدمين
// دالة لصفحة إدارة المستخدمين
async function loadUserManagementPage() {
    const container = document.getElementById('user-management-table-container');
    container.innerHTML = '<p style="text-align: center;">جاري تحميل قائمة المستخدمين...</p>';

    const { data: users, error } = await supabaseClient.from('users').select('*').order('name', { ascending: true });
    if (error) { container.innerHTML = '<p style="color:red;">حدث خطأ في جلب المستخدمين.</p>'; return; }

    container.innerHTML = `
        <table>
            <thead>
                <tr><th>الاسم</th><th>الدور</th><th>المشروع</th><th>الحالة</th><th>إجراءات</th></tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td>${user.name}</td>
                        <td>${user.role}</td>
                        <td>${user.project || '-'}</td>
                        <td><span class="status ${user.status === 'active' ? 'active' : 'inactive'}">${user.status === 'active' ? 'نشط' : 'غير نشط'}</span></td>
                        <td>
                            <button class="btn btn-secondary btn-sm admin-edit-user-btn" data-id="${user.id}" title="تعديل"><i class="ph-bold ph-pencil-simple"></i></button>
                            <button class="btn btn-danger btn-sm admin-delete-user-btn" data-id="${user.id}" data-auth-id="${user.auth_user_id}" title="حذف"><i class="ph-bold ph-trash"></i></button>
                            <button class="btn btn-secondary btn-sm admin-reset-password-btn" data-auth-id="${user.auth_user_id}" title="إعادة تعيين كلمة المرور"><i class="ph-bold ph-key"></i></button>
                            <button class="btn btn-secondary btn-sm admin-login-as-btn" data-user-id="${user.auth_user_id}" data-user-name="${user.name}" title="تسجيل الدخول كـ ${user.name}"><i class="ph-bold ph-sign-in"></i></button>
                            </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;
}
// ------------------------------------

// --- الخطوة 13: تحديث دالة الخريطة لجلب مواقع الحراس ---
let map; // متغير الخريطة معرف مسبقاً
let markersLayer = L.layerGroup(); // طبقة لتجميع علامات الحراس لتسهيل إدارتها

// ==================== بداية الاستبدال ====================
let mapSubscription = null; // متغير للتحكم في الاشتراك المباشر
let requestsSubscription = null; // متغير لاشتراك الطلبات المباشر

// ========= بداية الاستبدال الكامل للدالة =========
// ==========================================================
// ===   بداية الاستبدال الكامل لدالة initializeMap   ===
// ==========================================================
let allGuardsOnMap = []; // متغير لتخزين بيانات الحراس للبحث

// ==========================================================
// ===   بداية الاستبدال الكامل لدالة initializeMap   ===
// ==========================================================
async function initializeMap() {
    loadMapStatistics();
    if (!map) {
        map = L.map('map').setView([24.7136, 46.6753], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);
    }
    setTimeout(() => map.invalidateSize(), 100);

    markersLayer.clearLayers();
    guardMarkers.clear();
    allGuardsOnMap = [];
    if (mapSubscription) { supabaseClient.removeChannel(mapSubscription); mapSubscription = null; }
    markersLayer.addTo(map);

    try {
        const { data: presentAttendance, error: attendanceError } = await supabaseClient
            .from('attendance')
            .select('guard_id')
            .eq('status', 'حاضر');

        if (attendanceError) throw attendanceError;
        if (!presentAttendance || presentAttendance.length === 0) {
            console.log("No guards are currently checked in.");
            return;
        }

        const presentGuardIds = presentAttendance.map(att => att.guard_id);

        const { data: presentGuards, error: guardsError } = await supabaseClient
            .from('users')
            .select('id, name, project, location, guard_locations(latitude, longitude, created_at)')
            .in('id', presentGuardIds)
            .not('guard_locations', 'is', null);

        if (guardsError) throw guardsError;

        allGuardsOnMap = presentGuards;

        presentGuards.forEach(guard => {
            const loc = guard.guard_locations;
            if (loc && loc.latitude && loc.longitude) {
                const lastUpdate = new Date(loc.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
                const popupContent = `
                    <div style="font-family: 'Cairo', sans-serif;">
                        <h4 style="margin: 0 0 5px 0;">${guard.name}</h4>
                        <p style="margin: 0 0 5px 0;"><strong>المشروع:</strong> ${Array.isArray(guard.project) ? guard.project.join(', ') : guard.project || 'غير محدد'}</p>
                        <p style="margin: 0 0 8px 0;"><strong>الموقع:</strong> ${guard.location || 'غير محدد'}</p>
                        <small style="color: #6b7280;">آخر تحديث: ${lastUpdate}</small>
                    </div>
                `;
                const marker = L.marker([loc.latitude, loc.longitude]).bindPopup(popupContent);
                markersLayer.addLayer(marker);
                guardMarkers.set(guard.id, marker);
            }
        });

        if (window.zoomToGuardId) {
            const guardIdToFind = parseInt(window.zoomToGuardId, 10);
            if (guardMarkers.has(guardIdToFind)) {
                const markerToZoom = guardMarkers.get(guardIdToFind);
                map.setView(markerToZoom.getLatLng(), 17);
                markerToZoom.openPopup();
            } else {
                showToast('لم يتم العثور على موقع للحارس المحدد.', 'error');
            }
            window.zoomToGuardId = null;
        }

        mapSubscription = supabaseClient.channel('public-locations-and-attendance')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'guard_locations' }, (payload) => {
                const guardId = payload.new.guard_id;
                // --- بداية التعديل: تحديث النافذة المنبثقة مع الوقت الجديد ---
                if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && guardMarkers.has(guardId)) {
                    const markerToMove = guardMarkers.get(guardId);
                    markerToMove.setLatLng([payload.new.latitude, payload.new.longitude]);
                    
                    const guardData = allGuardsOnMap.find(g => g.id === guardId);
                    if (guardData) {
                        const lastUpdate = new Date(payload.new.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
                        const newPopupContent = `
                            <div style="font-family: 'Cairo', sans-serif;">
                                <h4 style="margin: 0 0 5px 0;">${guardData.name}</h4>
                                <p style="margin: 0 0 5px 0;"><strong>المشروع:</strong> ${Array.isArray(guardData.project) ? guardData.project.join(', ') : guardData.project || 'غير محدد'}</p>
                                <p style="margin: 0 0 8px 0;"><strong>الموقع:</strong> ${guardData.location || 'غير محدد'}</p>
                                <small style="color: #6b7280;">آخر تحديث: ${lastUpdate}</small>
                            </div>
                        `;
                        markerToMove.setPopupContent(newPopupContent);
                    }
                }
                // --- نهاية التعديل ---
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attendance' }, (payload) => {
                if (payload.new.checkout_at && guardMarkers.has(payload.new.guard_id)) {
                    const markerToRemove = guardMarkers.get(payload.new.guard_id);
                    markersLayer.removeLayer(markerToRemove);
                    guardMarkers.delete(payload.new.guard_id);
                }
            })
            .subscribe();

    } catch (error) {
        console.error('خطأ في جلب مواقع الحراس:', error);
    }
}
// ==========================================================
// ===    نهاية الاستبدال الكامل لدالة initializeMap    ===
// ==========================================================
// ========= نهاية الاستبدال الكامل للدالة =========
// ------------------------------------
// ------------------------------------

// ------------------------------------

// --- الخطوة 14: دالة لجلب وعرض الجداول والمناوبات ---
async function fetchSchedules() {
    const schedulesContent = document.querySelector('#page-schedules');
    schedulesContent.innerHTML = '<p style="text-align: center;">جاري تحميل الجداول...</p>';

    const { data: schedules, error } = await supabaseClient
        .from('schedules')
        .select(`
            start_time,
            end_time,
            users ( name ),
            clients ( name )
        `)
        .order('start_time', { ascending: true }); // ترتيب المناوبات حسب وقت البداية

    if (error) {
        console.error('خطأ في جلب الجداول:', error);
        schedulesContent.innerHTML = '<p style="text-align: center;">حدث خطأ أثناء تحميل الجداول.</p>';
        return;
    }

    if (schedules.length === 0) {
        schedulesContent.innerHTML = '<p style="text-align: center;">لا توجد مناوبات مجدولة حالياً.</p>';
        return;
    }

    schedulesContent.innerHTML = ''; // مسح رسالة التحميل

    // تجميع المناوبات حسب اليوم
    const groupedByDay = schedules.reduce((acc, schedule) => {
        const date = new Date(schedule.start_time).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(schedule);
        return acc;
    }, {});

    // إنشاء كود HTML لكل مجموعة يوم
    for (const day in groupedByDay) {
        const dayContainer = document.createElement('div');
        dayContainer.className = 'schedule-day-group';

        let dayHtml = `<h3>${day}</h3><div class="shifts-container">`;

        groupedByDay[day].forEach(shift => {
            const startTime = new Date(shift.start_time).toLocaleTimeString('ar-SA', { hour: 'numeric', minute: '2-digit', hour12: true });
            const endTime = new Date(shift.end_time).toLocaleTimeString('ar-SA', { hour: 'numeric', minute: '2-digit', hour12: true });

            dayHtml += `
                <div class="shift-card">
                    <div class="shift-time">${startTime} - ${endTime}</div>
                    <div class="shift-details">
                        <p><strong>الحارس:</strong> ${shift.users ? shift.users.name : 'غير محدد'}</p>
                        <p><strong>الموقع:</strong> ${shift.clients ? shift.clients.name : 'غير محدد'}</p>
                    </div>
                </div>
            `;
        });

        dayHtml += `</div>`;
        dayContainer.innerHTML = dayHtml;
        schedulesContent.appendChild(dayContainer);
    }
}
// ------------------------------------


async function loadPenaltiesPage(searchTerm = '') {
    const container = document.getElementById('penalties-employee-list');
    container.innerHTML = '<p style="text-align: center;">جاري تحميل الموظفين...</p>';

    let query = supabaseClient.from('users').select('id, name, role, project');
    if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
    }
    const { data: employees, error } = await query.order('name');

    if (error) {
        container.innerHTML = '<p style="color:red;">حدث خطأ في جلب الموظفين.</p>';
        return;
    }
    if (employees.length === 0) {
        container.innerHTML = '<p style="text-align: center;">لم يتم العثور على موظفين.</p>';
        return;
    }

    const employeeCards = employees.map(emp => `
        <div class="attendance-card">
            <div>
                <span>${emp.name}</span>
                <p class="time">${emp.role} - ${emp.project || 'غير محدد'}</p>
            </div>
            <button class="btn btn-danger add-penalty-btn" data-user-id="${emp.id}" data-user-name="${emp.name}">
                <i class="ph-bold ph-minus-circle"></i> إضافة عقوبة
            </button>
        </div>
    `).join('');
    container.innerHTML = `<div class="attendance-list">${employeeCards}</div>`;
}

// بداية الاستبدال
async function loadOpsDirectivesHistory() {
    const container = document.getElementById('ops-history-list-container');
    if (!container || !currentUser) return;
    container.innerHTML = '<p style="text-align: center;">جاري تحميل السجل...</p>';

    const { data: directives, error } = await supabaseClient
        .from('directives')
        .select(`*, recipient:recipient_id (name)`)
        .eq('sender_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = '<p style="text-align: center; color: red;">حدث خطأ في جلب السجل.</p>';
        return console.error(error);
    }

    if (directives.length === 0) {
        container.innerHTML = '<p style="text-align: center;">لم تقم بإرسال أي توجيهات بعد.</p>';
        return;
    }

    container.innerHTML = directives.map(d => {
        let statusClass, statusText;
        switch(d.status) {
            case 'accepted': statusClass = 'active'; statusText = 'تم القبول'; break;
            case 'rejected': statusClass = 'inactive'; statusText = 'تم الرفض'; break;
            default: statusClass = 'pending'; statusText = 'مرسل';
        }
        const date = new Date(d.created_at).toLocaleString('ar-SA');
        
        // --- هنا الجزء الجديد لعرض الملاحظات ---
        let notesFooter = '';
        if (d.status === 'rejected' && d.rejection_reason) {
            notesFooter = `<div class="request-card-footer"><strong>سبب الرفض:</strong> ${d.rejection_reason}</div>`;
        } else if (d.status === 'accepted' && d.acceptance_notes) {
            notesFooter = `<div class="request-card-footer" style="background-color: #e6f7ff; color: #005f8a; border-top: 1px solid #b3e0ff;"><strong>ملاحظات القبول:</strong> ${d.acceptance_notes}</div>`;
        }
        
        return `
            <div class="request-card" style="margin-bottom:15px;">
                <div class="request-card-header">
                    <h4>إلى: ${d.recipient ? d.recipient.name : 'مستخدم محذوف'}</h4>
                    <span class="status ${statusClass}">${statusText}</span>
                </div>
                <div class="request-card-body">
                    <p>${d.content}</p>
                    <small style="color: var(--text-secondary);">${date}</small>
                    ${notesFooter}
                </div>
            </div>
        `;
    }).join('');
}
// نهاية الاستبدال
// ------------------------------------

// بداية الاستبدال
async function loadMyVisitsPage() {
    const container = document.getElementById('my-visits-list-container');
    if (!container || !currentUser) return;
    container.innerHTML = '<p style="text-align: center;">جاري تحميل سجل زياراتك...</p>';

    // تصحيح: تم تغيير الربط من clients إلى contracts
    const { data: visits, error } = await supabaseClient
        .from('visits')
        .select(`*, contracts (company_name)`) // الربط مع العقود
        .eq('user_id', currentUser.id)
        .order('visit_time', { ascending: false });

    if (error) {
        container.innerHTML = '<p style="text-align: center; color: red;">حدث خطأ في جلب السجل.</p>';
        return console.error(error);
    }

    if (visits.length === 0) {
        container.innerHTML = '<p style="text-align: center;">لم تقم بتسجيل أي زيارات بعد.</p>';
        return;
    }

    container.innerHTML = visits.map(visit => {
        const visitTimestamp = new Date(visit.visit_time);
        const visitDate = visitTimestamp.toLocaleDateString('ar-SA', { day: 'numeric', month: 'long' });
        const visitTime = visitTimestamp.toLocaleTimeString('ar-SA', { hour: 'numeric', minute: '2-digit' });

        // تصحيح: عرض اسم الموقع من الزيارة مباشرة
        const locationDisplay = visit.location_name || 'موقع غير محدد';

        return `
            <div class="visit-card" style="margin-bottom: 15px;">
                <div class="visit-icon"><i class="ph-fill ph-car-profile"></i></div>
                <div class="visit-details">
                    <h4>زيارة إلى: ${locationDisplay}</h4>
                    <p class="visit-meta">
                        <span><i class="ph-bold ph-calendar"></i> ${visitDate} - ${visitTime}</span>
                    </p>
                    <p class="visit-notes">${visit.notes || 'لا توجد ملاحظات.'}</p>
                </div>
            </div>
        `;
    }).join('');
}
// نهاية الاستبدال
// بداية الاستبدال
// بداية الاستبدال

// ==========================================================
// ===   بداية الاستبدال الكامل لدالة loadMySchedulePage   ===
// ==========================================================
async function loadMySchedulePage() {
    const container = document.getElementById('my-schedule-container');
    if (!container || !currentUser) {
        return container.innerHTML = '<p>لا يمكن عرض الجدول.</p>';
    }
    container.innerHTML = '<p style="text-align: center;">جاري تحميل جدولك الأسبوعي...</p>';

    const dayTranslations = { Sun: 'الأحد', Mon: 'الاثنين', Tue: 'الثلاثاء', Wed: 'الأربعاء', Thu: 'الخميس', Fri: 'الجمعة', Sat: 'السبت' };
    const weekDaysOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklySchedule = {}; // كائن لتخزين بيانات كل يوم

    try {
        // التحضير بناءً على نوع الموظف
        if (currentUser.employment_status === 'اساسي') {
            const { data: userWithVacancy, error } = await supabaseClient.from('users').select('*, job_vacancies!users_vacancy_id_fkey(*)').eq('id', currentUser.id).single();
            if (error || !userWithVacancy?.job_vacancies?.schedule_details?.[0]) {
                throw new Error('لم يتم تعيين جدول ورديات لك.');
            }
            const shift = userWithVacancy.job_vacancies.schedule_details[0];
            weekDaysOrder.forEach(day => {
                if (shift.days.includes(day)) {
                    weeklySchedule[day] = {
                        type: 'work',
                        startTime: shift.start_time,
                        endTime: shift.end_time,
                        details: 'وردية أساسية'
                    };
                }
            });
        } else if (currentUser.employment_status === 'بديل راحة') {
            if (!currentUser.project || !currentUser.location) {
                throw new Error('أنت غير معين على موقع حالياً، لا يمكن إنشاء جدول ديناميكي.');
            }
            const { data: primaryGuards, error } = await supabaseClient
                .from('users').select('name, job_vacancies!inner!users_vacancy_id_fkey(schedule_details)')
                .eq('project', currentUser.project).eq('location', currentUser.location).eq('employment_status', 'اساسي');

            if (error) throw error;
            
            primaryGuards.forEach(guard => {
                const shift = guard.job_vacancies?.schedule_details?.[0];
                if (shift && shift.days) {
                    const offDays = weekDaysOrder.filter(day => !shift.days.includes(day));
                    offDays.forEach(day => {
                        weeklySchedule[day] = {
                            type: 'cover',
                            startTime: shift.start_time,
                            endTime: shift.end_time,
                            details: `تغطية لـ: ${guard.name}`
                        };
                    });
                }
            });
        // --- بداية الإضافة: منطق جديد لموظف التغطية ---
        } else if (currentUser.employment_status === 'تغطية') {
            const { data: assignment, error } = await supabaseClient
                .from('coverage_applicants')
                .select('coverage_shifts(*)')
                .eq('applicant_user_id', currentUser.id)
                .in('status', ['ops_final_approved', 'hr_approved'])
                .limit(1)
                .single();

            if (error || !assignment) {
                throw new Error('لم يتم العثور على وردية تغطية معينة لك حالياً.');
            }

            const shift = assignment.coverage_shifts;
            const shiftDate = new Date(shift.created_at);
            const dayKey = shiftDate.toLocaleString('en-US', { weekday: 'short' });

            if (weekDaysOrder.includes(dayKey)) {
                weeklySchedule[dayKey] = {
                    type: 'cover',
                    startTime: shift.start_time,
                    endTime: shift.end_time,
                    details: `تغطية في: ${shift.project}`
                };
            }
        // --- نهاية الإضافة ---
        } else {
            throw new Error('لا يمكن عرض جدول لهذا النوع من الموظفين.');
        }

        // بناء وعرض الواجهة النهائية (هذا الجزء لم يتغير)
        const todayIndex = new Date().getDay();
        let scheduleHtml = '<div class="schedule-week-grid">';

        weekDaysOrder.forEach((dayKey, index) => {
            const isCurrentDay = (index === todayIndex) ? 'current-day' : '';
            const dayData = weeklySchedule[dayKey];

            scheduleHtml += `<div class="schedule-day-card ${isCurrentDay}"><h4>${dayTranslations[dayKey]}</h4>`;
            
            if (dayData) {
                scheduleHtml += `
                    <div class="details">
                        <p class="time">${formatTimeAMPM(dayData.startTime)} - ${formatTimeAMPM(dayData.endTime)}</p>
                        <p>${dayData.details}</p>
                    </div>`;
            } else {
                scheduleHtml += `
                    <div class="details">
                        <p class="rest-day"><i class="ph-fill ph-coffee"></i> راحة</p>
                    </div>`;
            }
            scheduleHtml += '</div>';
        });

        scheduleHtml += '</div>';
        container.innerHTML = scheduleHtml;

    } catch (error) {
        container.innerHTML = `<p style="text-align: center; color: var(--denied-color);">${error.message}</p>`;
        console.error(error);
    }
}
// ==========================================================
// ===    نهاية الاستبدال الكامل للدالة    ===
// ==========================================================
// نهاية الاستبدال

// بداية الإضافة
async function loadSupervisorPermissionRequestsPage() {
    const container = document.getElementById('supervisor-permission-requests-container');
    if (!container || !currentUser || !currentUser.project) return;
    container.innerHTML = '<p style-align: center;>جاري تحميل الطلبات...</p>';

    // --- بداية التصحيح ---
    const { data: requests, error } = await supabaseClient
        .from('employee_requests')
        .select(`*, users:user_id!inner(name, project)`)
        .eq('request_type', 'permission')
        .eq('status', 'معلق')
        .filter('users.project', 'cs', `{${currentUser.project.join(',')}}`);
    // --- نهاية التصحيح ---

    if (error) { 
        container.innerHTML = '<p style="color:red;">حدث خطأ.</p>'; 
        console.error(error); 
        return; 
    }
    if (requests.length === 0) { 
        container.innerHTML = '<p style="text-align: center;">لا توجد طلبات استئذان معلقة حالياً.</p>'; 
        return; 
    }

    container.innerHTML = '';
    requests.forEach(request => {
        const cardHtml = `
        <div class="review-request-card">
            <div class="review-request-header status-pending">
                <h4>طلب استئذان</h4>
                <span class="status-badge">${request.status}</span>
            </div>
            <div class="review-request-body">
                <p><strong>مقدم الطلب:</strong> ${request.users.name}</p>
                <p><strong>السبب:</strong> ${request.details.reason}</p>
            </div>
            <div class="review-request-footer">
                <button class="btn btn-success supervisor-permission-action-btn" data-action="approve" data-request-id="${request.id}"><i class="ph-bold ph-arrow-up"></i> موافقة ورفع للعمليات</button>
                <button class="btn btn-danger supervisor-permission-action-btn" data-action="reject" data-request-id="${request.id}"><i class="ph-bold ph-x"></i> رفض</button>
            </div>
        </div>`;
        container.insertAdjacentHTML('beforeend', cardHtml);
    });
}
// نهاية الإضافة

// بداية الإضافة
async function loadSupervisorApplicationsPage() {
    const container = document.getElementById('supervisor-applications-container');
    if (!container || !currentUser || !currentUser.project) return;
    container.innerHTML = '<p style="text-align: center;">جاري تحميل طلبات التوظيف...</p>';

    const { data: applications, error } = await supabaseClient
        .from('job_applications')
        .select(`*, job_vacancies!inner(title, project, specific_location)`)
        .eq('status', 'pending_supervisor')
        

    if (error) { container.innerHTML = '<p style="color:red;">حدث خطأ.</p>'; return console.error(error); }
    if (applications.length === 0) { container.innerHTML = '<p style="text-align: center;">لا توجد طلبات توظيف جديدة لمراجعتها.</p>'; return; }

    // تجميع المتقدمين حسب الشاغر
    const groupedByVacancy = applications.reduce((acc, app) => {
        const vacancyId = app.vacancy_id;
        if (!acc[vacancyId]) {
            acc[vacancyId] = {
                details: app.job_vacancies,
                applicants: []
            };
        }
        acc[vacancyId].applicants.push(app);
        return acc;
    }, {});

    container.innerHTML = '';
    for (const vacancyId in groupedByVacancy) {
        const group = groupedByVacancy[vacancyId];
        const vacancyDetails = group.details;
        const applicants = group.applicants;

        const groupHtml = `
            <div class="attendance-accordion" style="margin-bottom: 20px;">
                <details open>
                    <summary style="font-size: 1.3rem;">
                        ${vacancyDetails.title} - ${vacancyDetails.specific_location || vacancyDetails.project} 
                        <span class="status pending" style="margin-right: auto;">(${applicants.length} متقدم)</span>
                    </summary>
                    <div class="content" style="padding-top: 15px;">
                        ${applicants.map(applicant => `
                            <div class="attendance-card">
                                <span>${applicant.applicant_data.full_name}</span>
                                <div>
                                    <button class="btn btn-secondary btn-sm view-applicant-details-btn" data-appid="${applicant.id}">عرض التفاصيل</button>
                                    <button class="btn btn-success btn-sm nominate-applicant-btn" data-appid="${applicant.id}" data-vid="${vacancyId}">
                                        <i class="ph-bold ph-check-fat"></i> ترشيح
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </details>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', groupHtml);
    }
}
// نهاية الإضافة


// بداية الإضافة
async function loadOpsNomineesPage() {
    const container = document.getElementById('ops-nominees-container');
    if (!container || !currentUser || !currentUser.region) return;
    container.innerHTML = '<p style="text-align: center;">جاري تحميل المرشحين...</p>';

    // -- بداية التعديل: فلترة حسب منطقة المدير --
    const { data: applications, error } = await supabaseClient
        .from('job_applications')
        .select(`*, 
            job_vacancies!inner(title, project, specific_location, region),
            supervisor:supervisor_approver_id (name)
        `)
        .eq('status', 'pending_ops')
        .eq('job_vacancies.region', currentUser.region);

    if (error) { container.innerHTML = '<p style="color:red;">حدث خطأ.</p>'; return console.error(error); }
    if (applications.length === 0) { container.innerHTML = '<p style="text-align: center;">لا يوجد مرشحون جدد لمراجعتهم.</p>'; return; }

    container.innerHTML = '';
    applications.forEach(app => {
        const vacancy = app.job_vacancies;
        const supervisor = app.supervisor;
        const applicant = app.applicant_data;

        const cardHtml = `
        <div class="review-request-card" style="margin-bottom: 20px;">
            <div class="review-request-header status-pending">
                <h4>مرشح لوظيفة: ${vacancy.title}</h4>
                <span class="status-badge">بانتظار الاعتماد</span>
            </div>
            <div class="review-request-body">
                 <div class="request-meta-grid" style="grid-template-columns: 1fr 1fr;">
                    <div class="request-meta-item"><i class="ph-bold ph-user"></i><span><strong>المرشح:</strong> ${applicant.full_name}</span></div>
                    <div class="request-meta-item"><i class="ph-bold ph-identification-card"></i><span><strong>الهوية:</strong> ${applicant.id_number}</span></div>
                    <div class="request-meta-item"><i class="ph-bold ph-map-pin"></i><span><strong>لشاغر:</strong> ${vacancy.specific_location || vacancy.project}</span></div>
                    <div class="request-meta-item"><i class="ph-bold ph-user-gear"></i><span><strong>المُرشِّح:</strong> ${supervisor.name}</span></div>
                </div>
            </div>
            <div class="review-request-footer">
                <button class="btn btn-primary ops-review-applicant-btn" data-appid="${app.id}">
                    <i class="ph-bold ph-user-plus"></i> مراجعة واعتماد
                </button>
                <button class="btn btn-danger ops-reject-applicant-btn" data-appid="${app.id}" data-vid="${app.vacancy_id}">
                    <i class="ph-bold ph-x-circle"></i> رفض
                </button>
            </div>
        </div>`;
        container.insertAdjacentHTML('beforeend', cardHtml);
    });
}
// نهاية الإضافة

// ========= بداية الاستبدال الكامل للدالة =========
async function loadHrOpsHiringPage(tab = 'new') {
    const containerId = (tab === 'new') ? 'hr-ops-hiring-new-container' : 'hr-ops-hiring-archive-container';
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `<p style="text-align: center;">جاري تحميل...</p>`;
    
    // تحديد الحالة المطلوبة بناءً على التبويب
    const statusFilter = (tab === 'new') ? ['approved'] : ['hr_acknowledged'];

    const { data: applications, error } = await supabaseClient
        .from('job_applications')
        .select(`*, job_vacancies(title, project)`)
        .in('status', statusFilter)
        // الترتيب حسب الأقدم (تصاعدي)
        .order('created_at', { ascending: true }); 

    if (error) {
        container.innerHTML = '<p style="color:red;">حدث خطأ في جلب البيانات.</p>';
        return console.error(error);
    }
    if (applications.length === 0) {
        container.innerHTML = `<p style="text-align: center;">لا توجد طلبات في ${tab === 'new' ? 'المراجعات الجديدة' : 'الأرشيف'}.</p>`;
        return;
    }

    container.innerHTML = '';
    applications.forEach(app => {
        const isAcknowledged = app.status === 'hr_acknowledged';
        const cardHtml = `
        <div class="review-request-card" style="margin-bottom: 20px;">
            <div class="review-request-header ${isAcknowledged ? 'status-denied' : 'status-approved'}">
                <h4>توظيف جديد: ${app.applicant_data.full_name}</h4>
                <span class="status-badge">${isAcknowledged ? 'تمت المراجعة' : 'بانتظار المراجعة'}</span>
            </div>
            <div class="review-request-body">
                <p><strong>الوظيفة:</strong> ${app.job_vacancies.title} في مشروع ${app.job_vacancies.project}</p>
                <p><strong>تاريخ التقديم:</strong> ${new Date(app.created_at).toLocaleDateString('ar-SA')}</p>
            </div>
            <div class="review-request-footer">
                <button class="btn btn-secondary view-applicant-details-btn" data-appid="${app.id}"><i class="ph-bold ph-eye"></i> عرض التفاصيل</button>
                <button class="btn btn-primary hr-acknowledge-hire-btn" data-appid="${app.id}" ${isAcknowledged ? 'disabled' : ''}><i class="ph-bold ph-check-square"></i> تأكيد المراجعة ونقل للأرشيف</button>
            </div>
        </div>`;
        container.insertAdjacentHTML('beforeend', cardHtml);
    });
}
// ========= نهاية الاستبدال الكامل للدالة =========

// --- بداية كود التحقق الدوري عن التوجيهات ---

let directivePollingInterval = null; // متغير لتخزين عملية التحقق
const notifiedDirectiveIds = new Set(); // لتخزين التوجيهات التي تم التنبيه عنها

// دالة لإيقاف التحقق (عند تسجيل الخروج مثلاً)
function stopPollingForDirectives() {
    if (directivePollingInterval) {
        clearInterval(directivePollingInterval);
        directivePollingInterval = null;
    }
}



// بداية الاستبدال
// --- دالة تحميل طلبات التغطية لمدير العمليات (النسخة الجديدة) ---
async function loadCoverageRequestsPage() {
    const container = document.getElementById('coverage-requests-container');
    if (!container || !currentUser || !currentUser.region) return;
    container.innerHTML = '<p style="text-align: center;">جاري تحميل الطلبات...</p>';

    const { data: requests, error } = await supabaseClient
        .from('coverage_applicants')
        .select(`*, 
            coverage_shifts!inner(project, location, region, coverage_pay), 
            users:applicant_user_id(name)
        `)
        .eq('status', 'pending_ops')
        .eq('coverage_shifts.region', currentUser.region);

    if (error) { container.innerHTML = '<p style="color:red;">حدث خطأ.</p>'; return console.error(error); }
    if (requests.length === 0) { container.innerHTML = '<p style="text-align: center;">لا توجد طلبات تغطية بانتظار المراجعة حالياً.</p>'; return; }

    container.innerHTML = '';
    requests.forEach(request => {
        const shift = request.coverage_shifts;
        const isEmployee = !!request.applicant_user_id;
        const applicantName = isEmployee ? request.users.name : request.full_name;
        
        let footerHtml = '';
        if (isEmployee) {
            footerHtml = `
                <button class="btn btn-success ops-coverage-action-btn" data-action="approve_employee" data-applicant-id="${request.id}" data-shift-id="${request.shift_id}">
                    <i class="ph-bold ph-check-circle"></i> اعتماد نهائي (عمل إضافي)
                </button>
                <button class="btn btn-danger ops-coverage-action-btn" data-action="reject" data-applicant-id="${request.id}">
                    <i class="ph-bold ph-x-circle"></i> رفض
                </button>`;
        } else {
            // --- هنا التصحيح: تمت إضافة data-shift-id للزر ---
            footerHtml = `
                <button class="btn btn-primary ops-coverage-action-btn" data-action="approve_external" data-applicant-id="${request.id}" data-shift-id="${request.shift_id}">
                    <i class="ph-bold ph-arrow-fat-up"></i>اعتماد المتقدم
                </button>
                <button class="btn btn-danger ops-coverage-action-btn" data-action="reject" data-applicant-id="${request.id}">
                    <i class="ph-bold ph-x-circle"></i> رفض
                </button>`;
        }

        const cardHtml = `
        <div class="review-request-card">
            <div class="review-request-header status-pending">
                <h4>طلب تغطية: ${shift.project}</h4>
                <span class="status-badge">${isEmployee ? 'موظف حالي' : 'متقدم خارجي'}</span>
            </div>
            <div class="review-request-body">
                <p><strong>المتقدم:</strong> ${applicantName}</p>
                <p><strong>الموقع:</strong> ${shift.location}</p>
                <p><strong>قيمة التغطية:</strong> ${shift.coverage_pay} ر.س</p>
            </div>
            <div class="review-request-footer">
                <button class="btn btn-secondary view-coverage-applicant-btn" data-appid="${request.id}" ${isEmployee ? 'disabled' : ''}>
                    <i class="ph-bold ph-eye"></i> عرض التفاصيل
                </button>
                ${footerHtml}
            </div>
        </div>`;
        container.insertAdjacentHTML('beforeend', cardHtml);
    });
}

// بداية الاستبدال
// دالة تحميل صفحة التوجيهات (النسخة النهائية للمشرف والحارس)
async function loadMyDirectivesPage() {
    const sendTab = document.querySelector('a[data-tab="send-directive-from-supervisor"]');
    const historyTab = document.querySelector('a[data-tab="supervisor-directives-history"]');

    if (currentUser.role === 'مشرف') {
        sendTab.style.display = 'flex';
        historyTab.style.display = 'flex';
    } else {
        sendTab.style.display = 'none';
        historyTab.style.display = 'none';
    }

    const incomingContainer = document.getElementById('my-directives-container');
    if (!incomingContainer || !currentUser) return;
    incomingContainer.innerHTML = '<p style="text-align: center;">جاري تحميل التوجيهات الواردة...</p>';

    const { data: directives, error: directivesError } = await supabaseClient
        .from('directives').select(`*, sender:sender_id (name, role)`).eq('recipient_id', currentUser.id).order('created_at', { ascending: false });

    if (directivesError) {
        incomingContainer.innerHTML = '<p style="color:red;">خطأ في جلب التوجيهات.</p>';
        return console.error(directivesError);
    }

    if (directives.length === 0) {
        incomingContainer.innerHTML = '<p style="text-align: center;">لا توجد لديك توجيهات واردة حالياً.</p>';
    } else {
        incomingContainer.innerHTML = directives.map(d => {
            const date = new Date(d.created_at).toLocaleString('ar-SA');
            let footer = (d.status === 'pending') ? `<div class="review-request-footer"><button class="btn btn-success directive-action-btn" data-action="accepted" data-directive-id="${d.id}"><i class="ph-bold ph-check"></i> قبول</button><button class="btn btn-danger directive-action-btn" data-action="rejected" data-directive-id="${d.id}"><i class="ph-bold ph-x"></i> رفض</button></div>` : '';
            return `<div class="visit-card" style="margin-bottom:15px; border-right-color: var(--accent-color);"><div class="visit-details" style="width: 100%;"><div style="display: flex; justify-content: space-between; align-items: start;"><h4>توجيه من: ${d.sender ? d.sender.name : 'غير معروف'} (${d.sender ? d.sender.role : ''})</h4><span class="visit-meta" style="padding:0; border:0;">${date}</span></div><p class="visit-notes" style="margin-top: 15px;">${d.content}</p></div></div>${footer}`;
        }).join('');
    }

    if (currentUser.role === 'مشرف' && currentUser.project) {
        const guardsContainer = document.getElementById('supervisor-guards-list-container');
        guardsContainer.innerHTML = '<p style="text-align: center;">جاري تحميل قائمة الحراس...</p>';
        
        // --- هنا التصحيح: استخدام الدالة الذكية لجلب الحراس ---
        const { data: guards, error: guardsError } = await supabaseClient.rpc('get_supervisor_guards', {
            p_supervisor_projects: currentUser.project
        });
        
        if (guardsError) {
            guardsContainer.innerHTML = '<p style="color:red;">خطأ في جلب الحراس.</p>';
        } else if (guards.length === 0) {
            guardsContainer.innerHTML = '<p style="text-align: center;">لا يوجد حراس في مشروعك لإرسال توجيهات لهم.</p>';
        } else {
            guardsContainer.innerHTML = guards.map(guard => `<div class="attendance-card"><div><span>${guard.name}</span><p class="time">${guard.location || 'غير محدد'}</p></div><button class="btn btn-primary open-directive-modal-btn" data-recipient-id="${guard.id}" data-recipient-name="${guard.name}"><i class="ph-bold ph-paper-plane-tilt"></i> إرسال توجيه</button></div>`).join('');
        }
    }
}
// نهاية الاستبدال

async function loadOpenVacanciesForCoverage() {
    const container = document.getElementById('open-vacancies-for-coverage-container');
    if (!container || !currentUser) return;
    container.innerHTML = '<p style="text-align: center;">جاري تحميل الشواغر...</p>';

    // --- بداية التصحيح: إضافة فلتر is_temporarily_covered ---
    let query = supabaseClient.from('job_vacancies')
        .select('*, schedule_details')
        .eq('status', 'open')
        .eq('is_temporarily_covered', false);
    // --- نهاية التصحيح ---
    
    if (currentUser.role === 'ادارة العمليات') query = query.eq('region', currentUser.region);
    else if (currentUser.role === 'مشرف') query = createProjectFilter(query, currentUser.project);

    const { data: vacancies, error } = await query;
    if (error) { container.innerHTML = '<p style="color:red">خطأ في جلب البيانات.</p>'; return; }
    if (vacancies.length === 0) { container.innerHTML = '<p>لا توجد شواغر مفتوحة حالياً.</p>'; return; }
    
    container.innerHTML = '';
    vacancies.forEach(vacancy => {
        const shift = vacancy.schedule_details ? vacancy.schedule_details[0] : {};
        const shiftData = {
            project: vacancy.project,
            location: vacancy.specific_location,
            region: vacancy.region,
            city: vacancy.location,
            linked_vacancy_id: vacancy.id,
            start_time: shift.start_time || '',
            end_time: shift.end_time || ''
        };

        const cardHtml = `
        <div class="hiring-card" style="border-left: 4px solid var(--accent-color);">
            <div class="hiring-card-header">
                <h5>${vacancy.title}: ${vacancy.project} - ${vacancy.specific_location}</h5>
                <button class="btn btn-secondary btn-sm add-to-coverage-btn" data-shift='${JSON.stringify(shiftData)}'>
                    <i class="ph-bold ph-plus"></i> إنشاء تغطية لهذا الشاغر
                </button>
            </div>
        </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHtml);
    });
}

// بداية الاستبدال
// بداية الاستبدال الكامل للدالة
async function loadSupervisorSchedulesPage() {
    const container = document.getElementById('supervisor-schedules-container');
    if (!container || !currentUser) return;
    container.innerHTML = '<p style="text-align: center;">جاري تحميل جداول الحراس...</p>';

    // -- بداية التعديل: إضافة حقل الموقع (location) للبيانات المطلوبة --
    let query = supabaseClient
        .from('users')
        .select(`name, project, location, employment_status, job_vacancies!users_vacancy_id_fkey(schedule_details)`)
        .eq('role', 'حارس أمن')
        .in('employment_status', ['اساسي', 'تغطية', 'بديل راحة']);
    // -- نهاية التعديل --

    if (currentUser.role === 'ادارة العمليات' && currentUser.region) {
        query = query.eq('region', currentUser.region);
    } else if (currentUser.role === 'مشرف' && currentUser.project) {
        query = createProjectFilter(query, currentUser.project);
    }

    const { data: guards, error } = await query;

    if (error) {
        container.innerHTML = '<p style="color:red;">حدث خطأ في جلب البيانات.</p>';
        return console.error(error);
    }
    if (guards.length === 0) {
        container.innerHTML = '<p style="text-align: center;">لا يوجد حراس لعرض جداولهم.</p>';
        return;
    }

    container.innerHTML = '';
    guards.forEach(guard => {
        let scheduleDetailsHtml = '';
        const schedule = guard.job_vacancies?.schedule_details?.[0];
        
        // -- بداية الإضافة: تجهيز متغير لعرض المشروع والموقع --
        const projectDisplay = Array.isArray(guard.project) ? guard.project.join(', ') : (guard.project || 'غير محدد');
        const locationDisplay = guard.location || 'غير محدد';
        const locationHtml = `
            <div class="info-line" style="border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 10px;">
                <i class="ph-bold ph-map-pin"></i>
                <strong>الموقع:</strong> ${projectDisplay} / ${locationDisplay}
            </div>
        `;
        // -- نهاية الإضافة --

        if (guard.employment_status === 'اساسي' && schedule) {
            const dayTranslations = { Sat: 'السبت', Sun: 'الأحد', Mon: 'الاثنين', Tue: 'الثلاثاء', Wed: 'الأربعاء', Thu: 'الخميس', Fri: 'الجمعة' };
            const workDays = schedule.days.map(day => dayTranslations[day] || day).join('، ');
            scheduleDetailsHtml = `
                <div class="info-line"><i class="ph-bold ph-user-focus"></i><strong>الحالة:</strong> أساسي</div>
                <div class="info-line"><i class="ph-bold ph-clock"></i><strong>الوقت:</strong> من ${formatTimeAMPM(schedule.start_time)} إلى ${formatTimeAMPM(schedule.end_time)}</div>
                <div class="info-line"><i class="ph-bold ph-calendar-check"></i><strong>أيام العمل:</strong> ${workDays}</div>
            `;
        } else if (guard.employment_status === 'بديل راحة') {
            scheduleDetailsHtml = `<div class="info-line"><i class="ph-bold ph-arrows-clockwise"></i><strong>الحالة:</strong> بديل راحة (يغطي أيام الراحة)</div>`;
        } else if (guard.employment_status === 'تغطية') {
            scheduleDetailsHtml = `<div class="info-line"><i class="ph-bold ph-shield-plus"></i><strong>الحالة:</strong> تغطية (جدول مؤقت حسب التكليف)</div>`;
        } else {
            scheduleDetailsHtml = `<p>بيانات الجدول غير متوفرة لهذا الحارس.</p>`;
        }
        
        container.insertAdjacentHTML('beforeend', `
            <div class="contract-card">
                <div class="contract-card-header"><h4>${guard.name}</h4></div>
                <div class="contract-card-body">
                    ${locationHtml}
                    ${scheduleDetailsHtml}
                </div>
            </div>
        `);
    });
}
// نهاية الاستبدال الكامل للدالة
// نهاية الاستبدال

// بداية الاستبدال
// دالة عرض ورديات التغطية (مع تنسيق الوقت وأزرار الإجراءات)
// --- دالة تحميل قائمة فرص التغطية (مع التحقق من صلاحية المدير) ---
// --- دالة تحميل صفحة التغطيات (النسخة الجديدة المكونة من عمودين) ---
// دالة تحميل صفحة التغطيات (النسخة النهائية مع التبويبات)
async function loadCoveragePage() {
    loadUncoveredNeeds();
    loadOpenVacanciesForCoverage(); // التأكد من استدعاء الدالة هنا
    
    const listContainer = document.getElementById('coverage-shifts-list');
    if (!listContainer || !currentUser) return;
    if (!currentUser.region && !currentUser.project) { listContainer.innerHTML = '<p>خطأ: لم يتم تعيين منطقة أو مشروع.</p>'; return; }
    listContainer.innerHTML = '<p>جاري التحميل...</p>';
    
    let query = supabaseClient.from('coverage_shifts').select('*').eq('status', 'open');
    if (currentUser.role === 'ادارة العمليات') query = query.eq('region', currentUser.region);
    else if (currentUser.role === 'مشرف') query = createProjectFilter(query, currentUser.project);
    
    const { data: shifts, error } = await query.order('created_at', { ascending: false });
    if (error) { listContainer.innerHTML = '<p style="color:red;">حدث خطأ.</p>'; return; }
    if (shifts.length === 0) { listContainer.innerHTML = '<p>لا توجد فرص تغطية مفتوحة.</p>'; return; }
    
    listContainer.innerHTML = shifts.map(shift => {
        let cleanProjectName = shift.project;
        if (typeof cleanProjectName === 'string') {
            cleanProjectName = cleanProjectName.replace(/[\[\]",]/g, '').trim();
        }

        const actionsHtml = `<div class="hiring-card-footer" style="padding: 10px 15px; border-top: 1px solid var(--border-color); display: flex; gap: 10px;"><button class="btn btn-secondary btn-sm edit-coverage-btn" data-shift-id="${shift.id}" style="flex-grow: 1;"><i class="ph-bold ph-pencil-simple"></i> تعديل</button><button class="btn btn-danger btn-sm delete-coverage-btn" data-shift-id="${shift.id}" style="flex-grow: 1;"><i class="ph-bold ph-trash"></i> حذف</button></div>`;
        return `<div class="hiring-card coverage-shift-item" data-shift-id='${JSON.stringify(shift)}' style="cursor: pointer; padding:0; margin-bottom: 0;"><div style="padding: 15px;"><h5>${cleanProjectName}</h5><p><i class="ph-bold ph-map-pin"></i> ${shift.location}</p><p><i class="ph-bold ph-clock"></i> ${formatTimeAMPM(shift.start_time)} - ${formatTimeAMPM(shift.end_time)}</p></div>${actionsHtml}</div>`;
    }).join('');

    document.querySelectorAll('#page-coverage .tab-link').forEach(tab => {
        tab.addEventListener('click', e => {
            e.preventDefault();
            document.querySelectorAll('#page-coverage .tab-link').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('#page-coverage .tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const targetContent = document.getElementById(tab.dataset.tab);
            if (targetContent) targetContent.classList.add('active');
            
            if (tab.dataset.tab === 'coverage-approval') {
                loadCompletedCoveragesForApproval();
            }
        });
    });
}
// نهاية الاستبدال

// ------------------------------------------------

// --- دالة عرض تفاصيل التغطية والقوائم الثلاث (العمود الأيسر) ---
// --- دالة عرض تفاصيل الوردية المختصرة ---
function displayCoverageDetails(shift) {
    const panel = document.getElementById('coverage-details-panel');
    panel.innerHTML = `
        <div class="contract-display">
            <h4>${shift.project} - ${shift.location}</h4>
            <p><strong>الوقت:</strong> من ${formatTimeAMPM(shift.start_time)} إلى ${formatTimeAMPM(shift.end_time)}</p>
            <p><strong>قيمة التغطية:</strong> ${shift.coverage_pay} ر.س</p>
            <button id="start-assignment-btn" class="btn btn-primary" style="width:100%; margin-top: 20px;">
                <i class="ph-bold ph-user-plus"></i> بدء عملية التعيين
            </button>
        </div>
    `;
}





// --- دالة تعبئة نافذة التعيين الذكية بالبيانات ---
async function populateAssignmentModal(shift) {
    const empContainer = document.getElementById('assign-employees');
    const nomContainer = document.getElementById('assign-nominees');
    const directContainer = document.getElementById('assign-direct');

    empContainer.innerHTML = nomContainer.innerHTML = directContainer.innerHTML = '<p>جاري التحميل...</p>';

    try {
        const [
            { data: nominatedExternals },
            { data: employeeApplicants },
            { data: availableGuards }
        ] = await Promise.all([
            supabaseClient.from('coverage_applicants').select(`*`).eq('shift_id', shift.id).eq('status', 'pending_ops').is('applicant_user_id', null),
            supabaseClient.from('coverage_applicants').select(`*, users!inner(name, id)`).eq('shift_id', shift.id).eq('status', 'pending_ops').not('applicant_user_id', 'is', null),
            supabaseClient.from('users').select('id, name').eq('project', shift.project).eq('location', shift.location).eq('employment_status', 'اساسي')
        ]);

        // تعبئة تبويب الموظفين المتقدمين
        empContainer.innerHTML = employeeApplicants.length > 0 ? employeeApplicants.map(app => `
            <div class="hiring-card"><div class="hiring-card-header"><h5>${app.users.name}</h5><button class="btn btn-success btn-sm assign-coverage-btn" data-type="overtime" data-employee-id="${app.users.id}" data-shift-id="${shift.id}" data-pay="${shift.coverage_pay}">تعيين (أوفر تايم)</button></div></div>
        `).join('') : '<p>لم يتقدم أي موظف حالي.</p>';

        // تعبئة تبويب المرشحين الخارجيين
        nomContainer.innerHTML = nominatedExternals.length > 0 ? nominatedExternals.map(app => `
            <div class="hiring-card"><div class="hiring-card-header"><h5>${app.full_name}</h5><button class="btn btn-primary btn-sm assign-coverage-btn" data-type="external" data-applicant-id="${app.id}" data-shift-id="${shift.id}">رفع للموارد البشرية</button></div></div>
        `).join('') : '<p>لا يوجد مرشحون خارجيون.</p>';

        // تعبئة تبويب التكليف المباشر
        directContainer.innerHTML = availableGuards.length > 0 ? availableGuards.map(guard => `
            <div class="hiring-card"><div class="hiring-card-header"><h5>${guard.name}</h5><button class="btn btn-secondary btn-sm assign-coverage-btn" data-type="direct" data-employee-id="${guard.id}" data-shift-id="${shift.id}" data-pay="${shift.coverage_pay}">تكليف مباشر</button></div></div>
        `).join('') : '<p>لا يوجد موظفون متاحون.</p>';
        
    } catch (error) {
        empContainer.innerHTML = nomContainer.innerHTML = directContainer.innerHTML = '<p style="color:red;">خطأ في تحميل البيانات.</p>';
    }
}


// ------------------------------------

// بداية الاستبدال
// --- دالة عرض الزيارات والجولات لمدير العمليات ---
// ==========================================================
// ===   بداية الاستبدال الكامل لدالة fetchVisits   ===
// ==========================================================
async function fetchVisits() {
    const visitsContent = document.querySelector('#page-visits');
    visitsContent.innerHTML = `
        <div class="page-header"><h3>سجل الميدان</h3></div>
        <div class="tabs">
            <a href="#" class="tab-link active" data-tab="visits-log"><i class="ph-bold ph-car-profile"></i> سجل الزيارات</a>
            <a href="#" class="tab-link" data-tab="patrols-log"><i class="ph-bold ph-footprints"></i> سجل الجولات</a>
        </div>
        <div id="visits-log" class="tab-content active">
            <div id="visits-list-container"><p style="text-align: center;">جاري تحميل سجل الزيارات...</p></div>
        </div>
        <div id="patrols-log" class="tab-content">
            <div id="patrols-list-container"><p style="text-align: center;">جاري تحميل سجل الجولات...</p></div>
        </div>
    `;

    const listContainer = document.querySelector('#visits-list-container');

    if (!currentUser || (currentUser.role === 'ادارة العمليات' && !currentUser.region)) {
        listContainer.innerHTML = '<p style="text-align: center;">لم يتم تحديد منطقة لك.</p>';
        return;
    }

    let query = supabaseClient
        .from('visits')
        .select(`*, contracts (company_name), users:user_id!inner(name, project, region)`)
        .order('visit_time', { ascending: false });

    if(currentUser.role === 'ادارة العمليات') {
        query = query.eq('users.region', currentUser.region);
    } 
    else if (currentUser.role === 'مشرف' && currentUser.project) {
        query = createProjectFilter(query, currentUser.project, 'users.project'); // <-- التعديل هنا
    }

    const { data: visits, error } = await query;

    if (error) {
        console.error('خطأ في جلب الزيارات:', error);
        listContainer.innerHTML = '<p style="text-align: center;">حدث خطأ أثناء تحميل الزيارات.</p>';
        return;
    }

    if (visits.length === 0) {
        listContainer.innerHTML = '<p style="text-align: center;">لا توجد زيارات مسجلة في نطاق صلاحياتك حالياً.</p>';
        return;
    }

    listContainer.innerHTML = '';
    visits.forEach(visit => {
        if (!visit.users) return;
        const visitTimestamp = new Date(visit.visit_time);
        const visitDate = visitTimestamp.toLocaleDateString('ar-SA', { day: 'numeric', month: 'long'});
        const visitTime = visitTimestamp.toLocaleTimeString('ar-SA', { hour: 'numeric', minute: '2-digit'});
        const locationDisplay = `${visit.users.project} - ${visit.location_name}`;
        const card = `
            <div class="visit-card">
                <div class="visit-icon"><i class="ph-fill ph-car-profile"></i></div>
                <div class="visit-details">
                    <h4>زيارة إلى: ${locationDisplay}</h4>
                    <p class="visit-meta">
                        <span><i class="ph-bold ph-user-circle"></i> المشرف: ${visit.users.name}</span>
                        <span><i class="ph-bold ph-calendar"></i> ${visitDate} - ${visitTime}</span>
                    </p>
                    <p class="visit-notes">${visit.notes || 'لا توجد ملاحظات.'}</p>
                </div>
            </div>
        `;
        listContainer.insertAdjacentHTML('beforeend', card);
    });
}
// ==========================================================
// ===    نهاية الاستبدال الكامل للدالة    ===
// ==========================================================
// نهاية الاستبدال


// ==========================================================
// ===   بداية دالة تحميل وعرض صفحة إدارة الإعلانات   ===
// ==========================================================
async function loadAnnouncementsPage() {
    const container = document.getElementById('announcements-list-container');
    const form = document.getElementById('announcement-form');
    form.reset();
    document.getElementById('announcement-id').value = '';

    container.innerHTML = '<p style="text-align: center;">جاري تحميل الإعلانات...</p>';

    const { data: announcements, error } = await supabaseClient
        .from('announcements')
        .select('*')
        .order('start_date', { ascending: false });

    if (error) {
        container.innerHTML = '<p style="color:red;">حدث خطأ في جلب الإعلانات.</p>';
        return;
    }

    if (announcements.length === 0) {
        container.innerHTML = '<p style="text-align: center;">لا توجد إعلانات لعرضها.</p>';
        return;
    }

    container.innerHTML = announcements.map(ann => {
        const now = new Date();
        const startDate = new Date(ann.start_date);
        const endDate = new Date(ann.end_date);
        let status, statusClass;

        if (!ann.is_active) {
            status = 'غير نشط'; statusClass = 'inactive';
        } else if (now >= startDate && now <= endDate) {
            status = 'فعال الآن'; statusClass = 'active';
        } else if (now < startDate) {
            status = 'مجدول'; statusClass = 'pending';
        } else {
            status = 'منتهي'; statusClass = 'inactive';
        }

        return `
        <div class="announcement-manage-card type-${ann.type}">
            <div class="review-request-body">
                <p class="content-text">${ann.content}</p>
                <div class="meta-info">
                    <span><strong>الحالة:</strong> <span class="status ${statusClass}">${status}</span></span>
                    <span><strong>النوع:</strong> ${ann.type}</span>
                </div>
                <div class="actions">
                    <button class="btn btn-secondary btn-sm edit-announcement-btn" data-id="${ann.id}"><i class="ph-bold ph-pencil-simple"></i> تعديل</button>
                    <button class="btn btn-danger btn-sm delete-announcement-btn" data-id="${ann.id}"><i class="ph-bold ph-trash"></i> حذف</button>
                </div>
            </div>
        </div>
        `;
    }).join('');
}
// ==========================================================
// ===     نهاية دالة تحميل وعرض صفحة إدارة الإعلانات     ===
// ==========================================================


// بداية الإضافة
async function loadPatrolsHistory() {
    const container = document.getElementById('patrols-list-container');
    if (!container || !currentUser || !currentUser.project) {
        container.innerHTML = '<p style="text-align: center;">لا يمكن عرض سجل الجولات.</p>';
        return;
    }
    container.innerHTML = '<p style="text-align: center;">جاري تحميل سجل الجولات...</p>';

     // -- بداية التعديل: فلترة حسب منطقة المدير --
    const { data: patrols, error } = await supabaseClient
        .from('patrols')
        .select(`*, supervisor:supervisor_id!inner(name, project, region)`)
        .eq('status', 'completed')
        .eq('supervisor.region', currentUser.region) // <-- هنا الفلترة
        .order('start_time', { ascending: false });
    // -- نهاية التعديل --

    if (error) {
        container.innerHTML = '<p style="text-align: center; color: red;">حدث خطأ في جلب السجل.</p>';
        return console.error(error);
    }

    if (patrols.length === 0) {
        container.innerHTML = '<p style="text-align: center;">لا توجد جولات مكتملة لعرضها.</p>';
        return;
    }

    container.innerHTML = '';
    patrols.forEach(patrol => {
        const startTime = new Date(patrol.start_time);
        const endTime = new Date(patrol.end_time);
        const durationMs = endTime - startTime;
        const durationMinutes = Math.round(durationMs / 60000);

        const card = `
            <div class="visit-card" style="border-right-color: #16a34a;">
                <div class="visit-icon" style="color: #16a34a;"><i class="ph-fill ph-footprints"></i></div>
                <div class="visit-details">
                    <h4>جولة للمشرف: ${patrol.supervisor ? patrol.supervisor.name : 'غير معروف'}</h4>
                    <p class="visit-meta">
                        <span><i class="ph-bold ph-calendar-check"></i> ${startTime.toLocaleDateString('ar-SA')}</span>
                        <span><i class="ph-bold ph-clock"></i> من ${startTime.toLocaleTimeString('ar-SA', {timeStyle: 'short'})} إلى ${endTime.toLocaleTimeString('ar-SA', {timeStyle: 'short'})}</span>
                        <span><i class="ph-bold ph-timer"></i> المدة: ${durationMinutes} دقيقة</span>
                    </p>
                    <p class="visit-notes">${patrol.notes || 'لا توجد ملاحظات.'}</p>
                </div>
                <div class="visit-actions">
                    <button class="btn btn-secondary view-patrol-path-btn" data-patrol-id="${patrol.id}">
                        <i class="ph-bold ph-map-trifold"></i> عرض المسار
                    </button>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', card);
    });
}
// نهاية الإضافة
// ------------------------------------
// --- دالة لجلب وعرض صفحة إدارة الشواغر ---
// --- دوال لوحة الموارد البشرية (بنظام التبويبات) ---

async function loadVacancyTabData() {
    const listContainer = document.getElementById('vacancies-list-container');
    const requiredEl = document.getElementById('hr-stats-required');
    const assignedEl = document.getElementById('hr-stats-assigned');
    const gapEl = document.getElementById('hr-stats-gap');

    if (!listContainer || !requiredEl || !assignedEl || !gapEl) return;
    
    listContainer.innerHTML = '<p style="text-align: center;">جاري حساب الإحصائيات وتحميل الشواغر...</p>';
    requiredEl.textContent = '...';
    assignedEl.textContent = '...';
    gapEl.textContent = '...';

    try {
        let totalRequiredGuards = 0;
        const { data: contracts, error: contractsError } = await supabaseClient.from('contracts').select('contract_locations').eq('status', 'active');
        if (contractsError) throw contractsError;
        
        if (contracts) {
            contracts.forEach(contract => {
                if (contract.contract_locations) {
                    contract.contract_locations.forEach(location => {
                        if (location.shifts) {
                            location.shifts.forEach(shift => {
                                totalRequiredGuards += parseInt(shift.guards_count) || 0;
                            });
                        }
                    });
                }
            });
        }
        requiredEl.textContent = totalRequiredGuards;

        // --- بداية التصحيح: تم تغيير الحالة الوظيفية هنا ---
        const { count: assignedGuards, error: usersError } = await supabaseClient
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'حارس أمن')
            .in('employment_status', ['اساسي', 'بديل راحة', 'تغطية']) // <-- هذا هو السطر الذي تم تعديله
            .not('vacancy_id', 'is', null);
        // --- نهاية التصحيح ---
            
        if (usersError) throw usersError;
        assignedEl.textContent = assignedGuards || 0;

        gapEl.textContent = totalRequiredGuards - (assignedGuards || 0);

        const { data: vacancies, error: vacanciesError } = await supabaseClient
            .from('job_vacancies')
            .select('*, contracts(company_name)')
            .order('created_at', { ascending: false });

        if (vacanciesError) throw vacanciesError;

        if (vacancies.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center;">لا توجد شواغر مضافة حالياً.</p>';
            return;
        }

        listContainer.innerHTML = `<div class="table-container"><table><thead><tr><th>المسمى الوظيفي</th><th>المشروع</th><th>الموقع المحدد</th><th>الحالة / الموظف المسؤول</th><th>إجراءات</th></tr></thead><tbody id="vacancies-table-body"></tbody></table></div>`;
        const tableBody = document.getElementById('vacancies-table-body');

        const { data: assignedUsers, error: assignedUsersError } = await supabaseClient.from('users').select('id, name, vacancy_id').not('vacancy_id', 'is', null);
        if (assignedUsersError) throw assignedUsersError;

        vacancies.forEach(vacancy => {
            let statusHtml;
            let actionsHtml;

            const assignedUser = assignedUsers.find(u => u.vacancy_id === vacancy.id);

            if (vacancy.status === 'closed' && assignedUser) {
                statusHtml = `<span class="status inactive">مغلق ( ${assignedUser.name} )</span>`;
                actionsHtml = `
                    <div style="display: flex; gap: 5px; justify-content: flex-end;">
                        <button class="btn btn-secondary btn-sm swap-assignment-btn" data-vacancy-id="${vacancy.id}" data-current-user-id="${assignedUser.id}" data-current-user-name="${assignedUser.name}" title="تبديل الموظف"><i class="ph-bold ph-arrows-clockwise"></i></button>
                        <button class="btn-action edit-vacancy-btn" data-id="${vacancy.id}" title="تعديل"><i class="ph-bold ph-pencil-simple"></i></button>
                        <button class="btn-action delete-vacancy-btn" data-id="${vacancy.id}" title="حذف"><i class="ph-bold ph-trash"></i></button>
                    </div>
                `;
            } else {
                 statusHtml = `<span class="status ${vacancy.status === 'open' ? 'active' : 'inactive'}">${vacancy.status === 'open' ? 'مفتوح' : 'مغلق'}</span>`;
                 actionsHtml = `
                    <div style="display: flex; gap: 5px; justify-content: flex-end;">
                        <button class="btn-action edit-vacancy-btn" data-id="${vacancy.id}" title="تعديل"><i class="ph-bold ph-pencil-simple"></i></button>
                        <button class="btn-action delete-vacancy-btn" data-id="${vacancy.id}" title="حذف"><i class="ph-bold ph-trash"></i></button>
                    </div>
                 `;
            }

            tableBody.insertAdjacentHTML('beforeend', `
                <tr>
                    <td>${vacancy.title}</td>
                    <td>${vacancy.project || (vacancy.contracts ? vacancy.contracts.company_name : 'غير محدد')}</td>
                    <td>${vacancy.specific_location || 'غير محدد'}</td>
                    <td>${statusHtml}</td>
                    <td>${actionsHtml}</td>
                </tr>
            `);
        });

    } catch (error) {
        console.error("Error loading vacancy data:", error);
        listContainer.innerHTML = `<p style="color:red;">حدث خطأ في تحميل بيانات الشواغر: ${error.message}</p>`;
    }
}
// دالة تحميل تبويب الموظفين
async function loadEmployeeTabData() {
    const container = document.getElementById('employees-list-container');
    container.innerHTML = '<p style="text-align: center;">جاري تحميل الموظفين...</p>';
// -- بداية الإضافة: قراءة قيم جميع الفلاتر --
    const searchVal = document.getElementById('employee-search-input').value;
    const roleVal = document.getElementById('employee-role-filter').value;
    const regionVal = document.getElementById('employee-region-filter').value;
    const projectVal = document.getElementById('employee-project-filter').value;
    const locationVal = document.getElementById('employee-location-filter').value;
    // -- نهاية الإضافة --

    let query = supabaseClient.from('users').select(`id, name, role, project, phone, employment_status, auth_user_id`);

    if (searchVal) {
        query = query.or(`name.ilike.%${searchVal}%,id_number.ilike.%${searchVal}%`);
    }
    if (roleVal) {
        query = query.eq('role', roleVal);
    }
    if (regionVal) {
        query = query.eq('region', regionVal);
    }
    if (projectVal) {
        query = query.filter('project', 'cs', `{${projectVal}}`);
    }
    if (locationVal) {
        query = query.ilike('location', `%${locationVal}%`);
    }

    const { data: employees, error } = await query.order('name', { ascending: true });

    if (error) {
        container.innerHTML = '<p style="text-align: center; color: red;">حدث خطأ في تحميل الموظفين.</p>';
        return console.error(error);
    }
    if (employees.length === 0) {
        container.innerHTML = '<p style="text-align: center;">لم يتم العثور على موظفين بهذه المواصفات.</p>';
        return;
    }

    container.innerHTML = `<table><thead><tr>
        <th>الاسم</th>
        <th>الدور</th>
        <th>رقم الجوال</th>
        <th>المشروع</th>
        <th>الحالة الوظيفية</th>
        <th>إجراءات</th>
    </tr></thead><tbody id="employees-table-body"></tbody></table>`;
    
    const tableBody = document.getElementById('employees-table-body');
    employees.forEach(emp => {
        let statusText = emp.employment_status || 'غير محدد';
        let statusClass = 'inactive';

        if (statusText === 'اساسي' || statusText === 'نشط') {
            statusText = 'أساسي';
            statusClass = 'active';
        } else if (statusText === 'بديل راحة' || statusText === 'تغطية') {
            statusClass = 'pending';
        }

        let projectDisplay = 'غير معين';
        if (Array.isArray(emp.project)) {
            projectDisplay = emp.project.join(' - ');
        } else if (emp.project) {
            projectDisplay = emp.project;
        }

        // --- بداية الإضافة: منطق تعطيل الأزرار ---
        let isDisabled = false;
        let disabledTitle = '';
        if (currentUser.role === 'ادارة الموارد البشرية' && emp.role === 'مدير النظام') {
            isDisabled = true;
            disabledTitle = 'لا يمكن التعديل على مدير النظام';
        }
        // --- نهاية الإضافة ---

        tableBody.insertAdjacentHTML('beforeend', `
            <tr>
                <td>${emp.name || 'غير متوفر'}</td>
                <td>${emp.role || 'غير محدد'}</td>
                <td>${emp.phone || 'غير مسجل'}</td>
                <td>${projectDisplay}</td>
                <td>
                    <span class="status ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td>
                    <button class="btn btn-secondary edit-employee-btn" data-id="${emp.id}" ${isDisabled ? `disabled title="${disabledTitle}"` : ''}><i class="ph-bold ph-pencil-simple"></i> تعديل</button>
                    <button class="btn btn-danger delete-employee-btn" data-id="${emp.id}" data-auth-id="${emp.auth_user_id}" ${isDisabled ? `disabled title="${disabledTitle}"` : ''}><i class="ph-bold ph-trash"></i> حذف</button>
                </td>
            </tr>
        `);
    });
}
// دالة مطورة لتحميل وعرض الطلبات في صفحة مراجعة الطلبات
// دالة مطورة لتحميل وعرض الطلبات في صفحة مراجعة الطلبات بالتصميم الاحترافي
// بداية الاستبدال
async function loadOperationsRequestsPage() {
    const container = document.getElementById('all-operations-requests-container');
    if (!container) return;
    container.innerHTML = '<p style="text-align: center;">جاري تحميل طلبات التوظيف...</p>';

    const { data: applications, error } = await supabaseClient
        .from('job_applications')
        .select(`*, job_vacancies!inner(title, project, specific_location)`)
        .eq('status', 'pending_supervisor')
        .eq('job_vacancies.project', currentUser.project);

    if (error) {
        container.innerHTML = '<p style="text-align: center; color: red;">حدث خطأ.</p>';
        return console.error(error);
    }
    if (requests.length === 0) {
        container.innerHTML = '<p style="text-align: center;">لا توجد طلبات توظيف حالياً.</p>';
        return;
    }

    requests.sort((a, b) => (a.status === 'معلق' ? -1 : 1) - (b.status === 'معلق' ? -1 : 1));
    container.innerHTML = '';

    requests.forEach(request => {
        const requestTime = new Date(request.created_at).toLocaleDateString('ar-SA', { day: 'numeric', month: 'long' });
        const emp = request.details;
        let footerHtml = '';

        let headerStatusClass = 'status-pending';
        if (request.status === 'مقبول') headerStatusClass = 'status-approved';
        if (request.status === 'مرفوض') headerStatusClass = 'status-denied';

        if (request.status === 'معلق') {
            footerHtml = `<div class="review-request-footer">
                <button class="btn btn-success approve-request-btn" data-request-id="${request.id}" data-type="hiring"><i class="ph-bold ph-check"></i> قبول</button>
                <button class="btn btn-danger reject-request-btn" data-request-id="${request.id}" data-type="hiring"><i class="ph-bold ph-x"></i> رفض</button>
            </div>`;
        } else if (request.status === 'مرفوض' && request.rejection_reason) {
            footerHtml = `<div class="request-card-footer"><strong>سبب الرفض:</strong> ${request.rejection_reason}</div>`;
        }

        const cardHtml = `
        <div class="review-request-card">
            <div class="review-request-header ${headerStatusClass}"><h4>طلب توظيف</h4><span class="status-badge">${request.status}</span></div>
            <div class="review-request-body">
                <div class="request-meta-grid">
                    <div class="request-meta-item"><i class="ph-bold ph-user-circle"></i><span><strong>مقدم الطلب:</strong> ${request.users ? request.users.name : 'غير معروف'}</span></div>
                    <div class="request-meta-item"><i class="ph-bold ph-calendar"></i><span><strong>تاريخ الطلب:</strong> ${requestTime}</span></div>
                </div>
                <div class="request-main-details">
                    <h5>بيانات الموظف المقترح</h5>
                    <div class="request-meta-grid" style="grid-template-columns: 1fr 1fr; border:0; padding:0; margin-bottom:10px;">
                        <p><strong>الاسم:</strong> ${emp.name}</p>
                        <p><strong>الهوية:</strong> ${emp.id_number}</p>
                        <p><strong>الدور:</strong> ${emp.role}</p>
                        <p><strong>المشروع:</strong> ${emp.project || 'غير محدد'}</p>
                    </div>
                </div>
            </div>
            ${footerHtml}
        </div>`;
        container.insertAdjacentHTML('beforeend', cardHtml);
    });
}
// نهاية الاستبدال

// بداية الإضافة: دوال تحميل الطلبات المنفصلة

// بداية الاستبدال
function renderRequests(requests, containerId, requestTypeTranslation) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (requests.length === 0) { container.innerHTML = `<p style="text-align: center;">لا توجد طلبات ${requestTypeTranslation} حالياً.</p>`; return; }
    requests.sort((a, b) => (a.status === 'معلق' || a.status === 'بانتظار موافقة الموارد البشرية' ? -1 : 1) - (b.status === 'معلق' || b.status === 'بانتظار موافقة الموارد البشرية' ? -1 : 1));
    container.innerHTML = '';
    requests.forEach(request => {
        let detailsHtml = '';
        if (request.details) {
            if (request.details.days) detailsHtml += `<p><strong>المدة:</strong> ${request.details.days} أيام</p>`;
            if (request.details.amount) detailsHtml += `<p><strong>المبلغ:</strong> ${request.details.amount} ر.س</p>`;
            if (request.details.reason) detailsHtml += `<p><strong>السبب:</strong> ${request.details.reason}</p>`;
        }
        let footerHtml = '';
        if (request.status === 'بانتظار موافقة الموارد البشرية') {
            footerHtml = `<div class="review-request-footer"><button class="btn btn-success request-action-button" data-approval-stage="hr_final" data-action="approve" data-request-id="${request.id}" data-request-type="${request.request_type}" data-user-id="${request.user_id}" data-vacancy-id="${request.users?.vacancy_id || ''}"><i class="ph-bold ph-check"></i> قبول نهائي</button><button class="btn btn-danger request-action-button" data-approval-stage="hr_final" data-action="reject" data-request-id="${request.id}"><i class="ph-bold ph-x"></i> رفض</button></div>`;
        } else if (request.status === 'مرفوض' && request.rejection_reason) {
            footerHtml = `<div class="request-card-footer"><strong>سبب الرفض:</strong> ${request.rejection_reason}</div>`;
        }
        const headerStatusClass = request.status === 'مقبول' ? 'status-approved' : (request.status === 'مرفوض' ? 'status-denied' : 'status-pending');
        const cardHtml = `<div class="review-request-card"><div class="review-request-header ${headerStatusClass}"><h4>طلب ${requestTypeTranslation}</h4><span class="status-badge">${request.status}</span></div><div class="review-request-body"><div class="request-meta-grid" style="grid-template-columns: 1fr;"><div class="request-meta-item"><i class="ph-bold ph-user-circle"></i><span><strong>مقدم الطلب:</strong> ${request.users ? request.users.name : 'غير معروف'}</span></div></div><div class="request-main-details">${detailsHtml}</div></div>${footerHtml}</div>`;
        container.insertAdjacentHTML('beforeend', cardHtml);
    });
}
// نهاية الاستبدال




// بداية الاستبدال
async function loadLeaveRequests() {
    const container = document.getElementById('all-leave-requests-container');
    container.innerHTML = '<p style="text-align: center;">جاري التحميل...</p>';
    const { data, error } = await supabaseClient
        .from('employee_requests')
        .select(`*, users:user_id (name, vacancy_id)`) // تحديد العلاقة الصحيحة
        .eq('request_type', 'leave')
        .eq('status', 'بانتظار موافقة الموارد البشرية') // جلب الطلبات الجاهزة فقط
        .order('created_at', { ascending: false });
    if(error) { container.innerHTML = '<p style="color:red;">حدث خطأ</p>'; return console.error(error); }
    renderRequests(data, 'all-leave-requests-container', 'إجازة');
}
// نهاية الاستبدال

// بداية الاستبدال
async function loadResignationRequests() {
    const container = document.getElementById('all-resignation-requests-container');
    container.innerHTML = '<p style="text-align: center;">جاري التحميل...</p>';
    const { data, error } = await supabaseClient
        .from('employee_requests')
        .select(`*, users:user_id (name, vacancy_id)`) // تحديد العلاقة الصحيحة
        .eq('request_type', 'resignation')
        .eq('status', 'بانتظار موافقة الموارد البشرية') // جلب الطلبات الجاهزة فقط
        .order('created_at', { ascending: false });
    if(error) { container.innerHTML = '<p style="color:red;">حدث خطأ</p>'; return console.error(error); }
    renderRequests(data, 'all-resignation-requests-container', 'استقالة');
}
// نهاية الاستبدال

// بداية الاستبدال
async function loadLoanRequests() {
    const container = document.getElementById('all-loan-requests-container');
    container.innerHTML = '<p style="text-align: center;">جاري التحميل...</p>';
    const { data, error } = await supabaseClient
        .from('employee_requests')
        .select(`*, users:user_id (name, vacancy_id)`) // تحديد العلاقة الصحيحة
        .eq('request_type', 'loan')
        .eq('status', 'بانتظار موافقة الموارد البشرية') // جلب الطلبات الجاهزة فقط
        .order('created_at', { ascending: false });
    if(error) { container.innerHTML = '<p style="color:red;">حدث خطأ</p>'; return console.error(error); }
    renderRequests(data, 'all-loan-requests-container', 'سلفة');
}
// نهاية الاستبدال

// بداية الاستبدال
// ========= بداية الاستبدال الكامل للدالة =========
async function loadHrAttendanceLogPage(filters = {}) {
    const container = document.getElementById('hr-attendance-accordion-container');
    container.innerHTML = '<p style="text-align: center;">جاري تحميل السجلات...</p>';

    try {
        let query = supabaseClient.from('attendance').select(`*, users ( name, region, project, location )`).order('created_at', { ascending: false });

        if (filters.status) query = query.eq('status', filters.status);
        if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
        if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
        if (filters.project) query = query.ilike('users.project', `%${filters.project}%`);
        if (filters.location) query = query.ilike('users.location', `%${filters.location}%`);

        const { data, error } = await query;
        if (error) throw error;
        if (data.length === 0) {
            container.innerHTML = '<p style="text-align: center;">لا توجد سجلات تطابق البحث.</p>';
            return;
        }

        const isAdmin = currentUser.role === 'مدير النظام';
        
        const groupedData = data.reduce((acc, record) => {
            if (!record.users) return acc;
            const key = `${record.users.region || 'غير محدد'} > ${record.users.project || 'غير محدد'} > ${record.users.location || 'غير محدد'}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(record);
            return acc;
        }, {});

        let accordionHtml = '';
        for (const groupName in groupedData) {
            const records = groupedData[groupName];
            const recordsTable = `
                <table class="records-table"><thead><tr>
                    <th>الحارس</th><th>الحضور</th><th>الانصراف</th><th>الحالة</th>
                    ${isAdmin ? '<th>إجراء</th>' : ''}
                </tr></thead><tbody>
                ${records.map(r => `
                    <tr>
                        <td>${r.users.name}</td>
                        <td>${r.created_at ? new Date(r.created_at).toLocaleString('ar-SA') : '-'}</td>
                        <td>${r.checkout_at ? new Date(r.checkout_at).toLocaleString('ar-SA') : '-'}</td>
                        <td><span class="status ${r.status === 'حاضر' ? 'active' : 'inactive'}">${r.status}</span></td>
                        ${isAdmin ? `<td><button class="btn btn-secondary btn-sm admin-edit-attendance-btn" data-id="${r.id}" data-name="${r.users.name}"><i class="ph-bold ph-pencil-simple"></i></button></td>` : ''}
                    </tr>
                `).join('')}
                </tbody></table>
            `;
            accordionHtml += `<details open><summary>${groupName}</summary><div class="content">${recordsTable}</div></details>`;
        }
        container.innerHTML = accordionHtml || '<p>لا توجد بيانات.</p>';

    } catch (err) {
        container.innerHTML = `<p style="color: red;">حدث خطأ: ${err.message}</p>`;
        console.error("HR Attendance Log Error:", err);
    }
}


// ========= نهاية الاستبدال الكامل للدالة =========

// ========= بداية الاستبدال الكامل لدالة generatePayroll (مع خصم التأخير واستثناء الموظفين) =========
async function generatePayroll() {
    const resultsContainer = document.getElementById('payroll-results-container');
    const startDateString = document.getElementById('payroll-start-date').value;
    const endDateString = document.getElementById('payroll-end-date').value;
    
    // --- بداية الإضافة: هنا تم إضافة الأسطر الثلاثة الناقصة ---
    const regionVal = document.getElementById('payroll-region-filter').value;
    const projectVal = document.getElementById('payroll-project').value;
    const locationVal = document.getElementById('payroll-location').value;
    // --- نهاية الإضافة ---

    if (!startDateString || !endDateString) return alert('الرجاء تحديد تاريخ البداية والنهاية.');
    
    resultsContainer.innerHTML = '<p style="text-align: center;">جاري جلب البيانات وحساب الرواتب...</p>';
    payrollExportData = [];

    try {
        const startDate = new Date(startDateString);
        const endDate = new Date(endDateString);
        endDate.setHours(23, 59, 59, 999);


        let query = supabaseClient
            .from('users')
            .select(`*, job_vacancies!users_vacancy_id_fkey(*, contracts!inner(*))`)
            .not('employment_status', 'in', '("تغطية", "مستقيل")');
        
        if (regionVal) {
            query = query.eq('region', regionVal);
        }
        if (projectVal) {
            // ملاحظة: بما أن المشروع قد يكون قائمة، نستخدم `cs` (contains)
            query = query.filter('project', 'cs', `{${projectVal}}`);
        }
        if (locationVal) {
            query = query.ilike('location', `%${locationVal}%`);
        }

        const { data: allEmployees, error: e1 } = await query;
            

        const [ 
            { data: attendanceRecords, error: e2 }, { data: leaveRecords, error: e3 }, 
            { data: penalties, error: e4 }, { data: officialHolidays, error: e5 },
            { data: permissionRequests, error: e6 }, { data: overtimeRecords, error: e7 }
        ] = await Promise.all([
            supabaseClient.from('attendance').select('*').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()),
            supabaseClient.from('employee_requests').select('user_id, details->>start_date, details->>days').eq('request_type', 'leave').eq('status', 'مقبول'),
            supabaseClient.from('penalties').select('user_id, amount').gte('deduction_date', startDateString).lte('deduction_date', endDateString),
            supabaseClient.from('official_holidays').select('holiday_date').gte('holiday_date', startDateString).lte('holiday_date', endDateString),
            supabaseClient.from('employee_requests').select('user_id, created_at').eq('request_type', 'permission').eq('status', 'مقبول').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()),
            supabaseClient.from('overtime_records').select('employee_id, overtime_pay').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString())
        ]);

        if (e1 || e2 || e3 || e4 || e5 || e6 || e7) throw (e1 || e2 || e3 || e4 || e5 || e6 || e7);

        if (allEmployees.length === 0) {
            resultsContainer.innerHTML = '<p style="text-align: center;">لم يتم العثور على موظفين.</p>';
            return;
        }

        const holidayDates = new Set(officialHolidays.map(h => new Date(h.holiday_date).toDateString()));
        const primaryGuards = allEmployees.filter(emp => emp.employment_status === 'اساسي');

        for (const emp of allEmployees) {
            if (emp.employment_status === 'بديل راحة') {
                // (منطق البديل يبقى كما هو)
            } else {
                const vacancy = emp.job_vacancies;
                if (!vacancy || !vacancy.schedule_details?.length) continue;
                
                const shift = vacancy.schedule_details[0];
                const fullMonthSalary = (vacancy.base_salary || 0) + (vacancy.housing_allowance || 0) + (vacancy.transport_allowance || 0) + (vacancy.other_allowances || 0);
                const dailyRate = fullMonthSalary / 30;
                const hourlyRate = dailyRate / (shift.work_hours || 8);
                
                let scheduledWorkDays = 0, restDays = 0, absentDays = 0, totalLatenessMinutes = 0;
                const empStartDate = emp.start_of_work_date ? new Date(emp.start_of_work_date) : null;
                const effectiveStartDate = (empStartDate && empStartDate > startDate) ? empStartDate : startDate;

                for (let day = new Date(effectiveStartDate); day <= endDate; day.setDate(day.getDate() + 1)) {
                    const dayName = day.toLocaleDateString('en-US', { weekday: 'short' });
                    if ((shift.days || []).includes(dayName)) {
                        scheduledWorkDays++;
                        const attendanceRecord = attendanceRecords.find(att => att.guard_id === emp.id && new Date(att.created_at).toDateString() === day.toDateString());
                        const isOnLeave = leaveRecords.some(leave => { const d = new Date(leave['details->>start_date']); return leave.user_id === emp.id && day >= d && day < new Date(d.setDate(d.getDate() + parseInt(leave['details->>days']))); });
                        
                        if (attendanceRecord) {
                            const shiftStartTime = new Date(day);
                            const [startHours, startMinutes] = shift.start_time.split(':');
                            shiftStartTime.setHours(startHours, startMinutes, 0, 0);
                            const checkinTime = new Date(attendanceRecord.created_at);
                            if (checkinTime > shiftStartTime) {
                                const latenessMs = checkinTime - shiftStartTime;
                                totalLatenessMinutes += Math.round(latenessMs / 60000);
                            }
                        } else if (!isOnLeave && !holidayDates.has(day.toDateString())) {
                            absentDays++;
                        }
                    } else { restDays++; }
                }

                // --- بداية التعديلات المطلوبة ---
                const actualWorkDays = scheduledWorkDays - absentDays;
                const totalWorkHours = actualWorkDays * (shift.work_hours || 8);
                const permissionRecords = permissionRequests.filter(req => req.user_id === emp.id);
                const withdrawalRecords = attendanceRecords.filter(att => att.guard_id === emp.id && att.status === 'انسحاب');
                const projectName = Array.isArray(emp.project) ? emp.project.join(', ') : (emp.project || '');

                const absenceDeduction = (absentDays * 2) * dailyRate;
                const latenessDeduction = (totalLatenessMinutes * (hourlyRate / 60));
                const withdrawalDeductionValue = (dailyRate * withdrawalRecords.length) + (dailyRate * 2 * withdrawalRecords.length);
                const permissionDeductionValue = dailyRate * permissionRecords.length;
                // --- نهاية التعديلات المطلوبة ---

                let grossSalary = fullMonthSalary;
                if (empStartDate && empStartDate > startDate) {
                    const daysInMonth = (endDate - startDate) / (1000 * 60 * 60 * 24) + 1;
                    grossSalary = (fullMonthSalary / daysInMonth) * scheduledWorkDays;
                }
                
                const employeeOvertimeTotal = overtimeRecords.filter(o => o.employee_id === emp.id).reduce((total, o) => total + (o.overtime_pay || 0), 0);
                const otherDeductions = penalties.filter(p => p.user_id === emp.id).reduce((total, p) => total + (p.amount || 0), 0);
                const isFirstMonth = empStartDate && empStartDate >= startDate && empStartDate <= endDate;
                const uniformDeduction = isFirstMonth ? 150 : 0;
                const insuranceDeduction = emp.insurance_status === 'مسجل' ? (emp.insurance_deduction_amount || 0) : 0;
                
                const totalDeductions = absenceDeduction + latenessDeduction + otherDeductions + uniformDeduction + insuranceDeduction + withdrawalDeductionValue + permissionDeductionValue;
                const netSalary = (grossSalary + employeeOvertimeTotal) - totalDeductions;
                
                payrollExportData.push({
                    "اسم الموظف": emp.name,
                    "رقم الهوية": emp.id_number,
                    "حالة الموظف": emp.employment_status,
                    "المشروع": projectName,
                    "ايام العمل": actualWorkDays,
                    "ساعات العمل": totalWorkHours,
                    "قيمة الساعة": hourlyRate,
                    "قيمة اليومية": dailyRate,
                    "الراتب الاساسي": vacancy.base_salary,
                    "بدل السكن": vacancy.housing_allowance,
                    "بدل نقل": vacancy.transport_allowance,
                    "بدلات اخرى": vacancy.other_allowances,
                    "اجمالي الراتب": fullMonthSalary,
                    "راحة": restDays,
                    "عمل اضافي": employeeOvertimeTotal,
                    "المستحق": grossSalary + employeeOvertimeTotal,
                    "استقطاع تأمينات": insuranceDeduction,
                    "خصم الزي": uniformDeduction,
                    "خصم تأخير": latenessDeduction,
                    "استئذان": permissionRecords.length, // عدد أيام الاستئذان
                    "انسحاب": withdrawalRecords.length, // عدد أيام الانسحاب
                    "ايام الغياب": absentDays,
                    "خصم الغياب": absenceDeduction,
                    "خصومات اخرى": otherDeductions,
                    "مجموع الاستقطاعات": totalDeductions,
                    "الصافي": netSalary,
                    "الايبان": emp.iban,
                    "البنك": emp.bank_name,
                });
            }
        }
        
        // (باقي الكود لعرض الجدول في الصفحة لم يتغير)
        const tableHeaders = payrollExportData.length > 0 ? Object.keys(payrollExportData[0]).map(key => `<th>${key}</th>`).join('') : '';
        const nonCurrencyColumns = ['اسم الموظف', 'رقم الهوية', 'حالة الموظف', 'موقع العمل', 'المشروع', 'رقم الجوال', 'ايام العمل', 'ساعات العمل', 'راحة', 'ايام الغياب', 'الايبان', 'البنك', 'المنطقة', 'المدينة', 'حالة التأمينات', 'استئذان', 'انسحاب'];
        
        const tableRowsHtml = payrollExportData.map(row => {
            let rowHtml = '<tr>';
            for (const key in row) {
                let value = row[key];
                if (typeof value === 'number' && !nonCurrencyColumns.includes(key)) {
                    value = `${value.toFixed(2)} ر.س`;
                }
                if (row['حالة الموظف'] === 'بديل راحة' && (key === 'قيمة الساعة' || key === 'قيمة اليومية')) {
                    value = 'متغيرة';
                }
                rowHtml += `<td>${value || '-'}</td>`;
            }
            rowHtml += '</tr>';
            return rowHtml;
        }).join('');

        resultsContainer.innerHTML = `<div class="table-header"><h3>مسير رواتب من ${startDateString} إلى ${endDateString}</h3><button id="export-payroll-btn" class="btn btn-success"><i class="ph-bold ph-file-xls"></i> تصدير إلى Excel</button></div><table><thead><tr>${tableHeaders}</tr></thead><tbody>${tableRowsHtml}</tbody></table>`;

        await supabaseClient.from('audit_logs').insert({ user_name: currentUser.name, action_type: 'توليد مسير الرواتب', details: { startDate: startDateString, endDate: endDateString, employeeCount: payrollExportData.length } });

    } catch (err) {
        resultsContainer.innerHTML = `<p style="color: red;">حدث خطأ: ${err.message}</p>`;
        console.error("Payroll Error:", err);
    }
}
// ========= نهاية الاستبدال الكامل لدالة generatePayroll =========

async function exportPayrollToExcel(data, filename) {
    if (data.length === 0) return alert('لا توجد بيانات للتصدير.');

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('مسير رواتب', {
        views: [{ rightToLeft: true }]
    });

    // --- تم حذف كود إضافة الشعار من هنا ---

    const headerStyle = {
        font: { name: 'Cairo', size: 12, bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: { bottom: { style: 'thin', color: { argb: 'FF000000' } } }
    };
    const cellStyle = { font: { name: 'Cairo', size: 10 }, alignment: { horizontal: 'center', vertical: 'middle' } };
    const moneyStyle = { ...cellStyle, numFmt: '#,##0.00 "ر.س"' };
    const totalStyle = { ...moneyStyle, font: { ...cellStyle.font, bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } } };

    worksheet.columns = Object.keys(data[0]).map(key => ({
        header: key, key: key, width: 18, style: cellStyle
    }));

    worksheet.addRows(data);

    // --- بداية التعديل: إضافة الأعمدة الجديدة هنا ---
    const nonMoneyColumns = ['ايام العمل', 'ساعات العمل', 'راحة', 'ايام الغياب', 'استئذان', 'انسحاب'];
    // --- نهاية التعديل ---

    worksheet.eachRow({ includeEmpty: false }, function(row, rowNumber) {
        row.height = 25;
        row.eachCell({ includeEmpty: true }, function(cell, colNumber) {
            if (rowNumber === 1) {
                cell.style = headerStyle;
                return;
            }
            const key = worksheet.getColumn(colNumber).key;
            if (['اجمالي الراتب', 'مجموع الاستقطاعات', 'الصافي'].includes(key)) {
                cell.style = totalStyle;
            }
            if (typeof cell.value === 'number' && !nonMoneyColumns.includes(key)) {
                cell.numFmt = moneyStyle.numFmt;
            }
        });
    });

    workbook.xlsx.writeBuffer().then(function(buffer) {
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename.replace('.csv', '.xlsx');
        link.click();
    });
}


// --- دالة رئيسية لإدارة تبويبات صفحة المالية ---
async function loadFinanceCoveragePage() {
    loadFinancePendingPage(); // تحميل التبويب الأول افتراضياً

    const financePage = document.getElementById('page-finance-coverage');
    if (financePage && !financePage.dataset.listenerAttached) {
        financePage.querySelector('.tabs').addEventListener('click', (event) => {
            event.preventDefault();
            const tabLink = event.target.closest('.tab-link');
            if (!tabLink) return;

            financePage.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
            tabLink.classList.add('active');
            financePage.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(tabLink.dataset.tab)?.classList.add('active');

            if (tabLink.dataset.tab === 'finance-pending-tab') {
                loadFinancePendingPage();
            } else if (tabLink.dataset.tab === 'finance-archive-tab') {
                loadFinanceArchivePage();
            }
        });
        financePage.dataset.listenerAttached = 'true';
    }
}

// --- دالة لجلب أرشيف التحويلات المالية ---
async function loadFinanceArchivePage() {
    const container = document.getElementById('finance-archive-container');
    container.innerHTML = '<p style="text-align: center;">جاري تحميل الأرشيف...</p>';
    
    const { data, error } = await supabaseClient
        .from('coverage_payments')
        .select('*')
        .eq('status', 'paid')
        .order('created_at', { ascending: false });

    if (error) { container.innerHTML = '<p style="color:red">خطأ في جلب البيانات.</p>'; return; }
    if (data.length === 0) { container.innerHTML = '<p>لا يوجد دفعات مؤرشفة حالياً.</p>'; return; }

    container.innerHTML = `
        <div class="table-container"><table>
            <thead><tr><th>اسم الحارس</th><th>المبلغ</th><th>تاريخ الوردية</th><th>الآيبان</th><th>الحالة</th></tr></thead>
            <tbody>
                ${data.map(p => `
                    <tr>
                        <td>${p.covering_guard_name}</td>
                        <td>${p.payment_amount} ر.س</td>
                        <td>${p.shift_date}</td>
                        <td>${p.applicant_iban}</td>
                        <td><span class="status active">تم الدفع</span></td>
                    </tr>`).join('')}
            </tbody>
        </table></div>`;
}

// --- دالة لجلب المستحقات بانتظار الدفع ---
async function loadFinancePendingPage() {
    const container = document.getElementById('finance-pending-container');
    container.innerHTML = '<p style="text-align: center;">جاري تحميل المستحقات...</p>';
    
    const { data, error } = await supabaseClient
        .from('coverage_payments')
        .select('*')
        .eq('status', 'pending_finance_transfer')
        .order('created_at', { ascending: false });

    if (error) { container.innerHTML = '<p style="color:red">خطأ في جلب البيانات.</p>'; return; }
    if (data.length === 0) { container.innerHTML = '<p>لا توجد مستحقات بانتظار التحويل حالياً.</p>'; return; }
    
    pendingPaymentsData = data;
    container.innerHTML = `
        <div class="table-container"><table>
            <thead><tr><th>اسم الحارس</th><th>المبلغ</th><th>الآيبان</th><th>البنك</th><th>إجراء</th></tr></thead>
            <tbody>
                ${data.map(p => `
                    <tr>
                        <td>${p.covering_guard_name}</td>
                        <td>${p.payment_amount} ر.س</td>
                        <td>${p.applicant_iban}</td>
                        <td>${p.applicant_bank_name || 'غير محدد'}</td>
                        <td>
                            <button class="btn btn-success finalize-payment-btn" data-payment-id="${p.id}">
                                <i class="ph-bold ph-check-circle"></i> تم التحويل والأرشفة
                            </button>
                        </td>
                    </tr>`).join('')}
            </tbody>
        </table></div>`;
}

// --- دالة تحميل تبويب "أرشيف التحويلات" ---
async function loadPaymentArchive() {
    const container = document.getElementById('finance-archive-container');
    container.innerHTML = '<p style="text-align: center;">جاري تحميل الأرشيف...</p>';

    const { data: archive, error } = await supabaseClient
        .from('payment_archive')
        .select('*, users:paid_by_user_id(name)')
        .order('paid_at', { ascending: false });
        
    if (error) { container.innerHTML = '<p style="color:red;">حدث خطأ.</p>'; return console.error(error); }
    if (archive.length === 0) { container.innerHTML = '<p style="text-align: center;">الأرشيف فارغ حالياً.</p>'; return; }

    const tableHeaders = "<th>تاريخ التحويل</th><th>اسم المستلم</th><th>المبلغ</th><th>الآيبان</th><th>تاريخ الوردية</th><th>تم التحويل بواسطة</th>";
    const tableRows = archive.map(a => `
        <tr>
            <td>${new Date(a.paid_at).toLocaleString('ar-SA')}</td>
            <td>${a.covering_guard_name}</td>
            <td>${a.payment_amount} ر.س</td>
            <td>${a.applicant_iban}</td>
            <td>${new Date(a.shift_date).toLocaleDateString('ar-SA')}</td>
            <td>${a.users.name}</td>
        </tr>
    `).join('');
    container.innerHTML = `<table><thead><tr>${tableHeaders}</tr></thead><tbody>${tableRows}</tbody></table>`;
}

// --- دالة توليد مسير الحراس الغائبين للتدقيق ---
async function generateAbsenteeReport() {
    const modal = document.getElementById('absentee-report-modal');
    const body = document.getElementById('absentee-report-body');
    modal.classList.remove('hidden');
    body.innerHTML = '<p style="text-align: center;">جاري تحليل البيانات...</p>';
    absenteeReportData = []; // إفراغ البيانات القديمة

    try {
        const { data: payments, error: e1 } = await supabaseClient
            .from('coverage_payments')
            .select('absent_guard_name, shift_date')
            .eq('status', 'pending_payment');
        if (e1) throw e1;

        if (payments.length === 0) {
            body.innerHTML = '<p style="text-align: center;">لا توجد تغطيات معتمدة لتوليد تقرير لها.</p>';
            return;
        }

        const absentGuardNames = [...new Set(payments.map(p => p.absent_guard_name))].filter(name => name);
        if (absentGuardNames.length === 0) {
            body.innerHTML = '<p style="text-align: center;">لا يوجد أسماء حراس غائبين مسجلة في التغطيات الحالية.</p>';
            return;
        }

        const { data: absentGuards, error: e2 } = await supabaseClient
            .from('users')
            .select('*, job_vacancies!users_vacancy_id_fkey(*)')
            .in('name', absentGuardNames);
        if (e2) throw e2;

        let reportHtml = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>اسم الحارس الغائب</th>
                            <th>تاريخ الغياب</th>
                            <th>قيمة اليومية</th>
                            <th>خصم الغياب (يوميتين)</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        let foundAbsence = false;
        payments.forEach(payment => {
            const guard = absentGuards.find(g => g.name === payment.absent_guard_name);
            if (guard && guard.job_vacancies) {
                foundAbsence = true;
                const vacancy = guard.job_vacancies;
                const fullSalary = (vacancy.base_salary || 0) + (vacancy.housing_allowance || 0) + (vacancy.transport_allowance || 0) + (vacancy.other_allowances || 0);
                const dailyRate = fullSalary / 30;
                const absenceDeduction = dailyRate * 2;
                
                reportHtml += `
                    <tr>
                        <td>${guard.name}</td>
                        <td>${new Date(payment.shift_date).toLocaleDateString('ar-SA')}</td>
                        <td>${dailyRate.toFixed(2)} ر.س</td>
                        <td style="color: var(--denied-color); font-weight: bold;">${absenceDeduction.toFixed(2)} ر.س</td>
                    </tr>
                `;

                // تجهيز بيانات التصدير بنفس هيكل المسير الكامل
                absenteeReportData.push({
                    "اسم الموظف": guard.name, "رقم الهوية": guard.id_number, "حالة الموظف": guard.employment_status,
                    "موقع العمل": guard.location, "المشروع": guard.project, "رقم الجوال": guard.phone,
                    "ايام العمل": 0, "ساعات العمل": 0, "قيمة الساعة": 0, "قيمة اليومية": dailyRate,
                    "الراتب الاساسي": 0, "بدل السكن": 0, "بدل نقل": 0, "بدلات اخرى": 0,
                    "اجمالي الراتب": 0, "بدل اجازة": 0, "راحة": 0, "عمل اضافي": 0, "المستحق": 0,
                    "ايام الغياب": 1, "استقطاع تأمينات": 0, "خصم الزي": 0, "خصم الغياب": absenceDeduction,
                    "خصم تأخير": 0, "مجموع الاستقطاعات": absenceDeduction, "الصافي": -absenceDeduction,
                    "الايبان": guard.iban, "البنك": guard.bank_name, "المنطقة": guard.region,
                    "المدينة": guard.city, "حالة التأمينات": guard.insurance_status
                });
            }
        });

        reportHtml += `</tbody></table></div>`;
        body.innerHTML = foundAbsence ? reportHtml : '<p style="text-align: center;">لم يتم العثور على بيانات الرواتب للحراس الغائبين.</p>';

    } catch (error) {
        body.innerHTML = `<p style="color:red;">حدث خطأ أثناء توليد التقرير: ${error.message}</p>`;
    }
}

// --- دالة تحميل تبويب "أرشيف التحويلات" ---
async function loadPaymentArchive() {
    const container = document.getElementById('finance-archive-container');
    container.innerHTML = '<p style="text-align: center;">جاري تحميل الأرشيف...</p>';

    const { data: archive, error } = await supabaseClient
        .from('payment_archive')
        .select('*, users:paid_by_user_id(name)')
        .order('paid_at', { ascending: false });
        
    if (error) { container.innerHTML = '<p style="color:red;">حدث خطأ.</p>'; return console.error(error); }
    if (archive.length === 0) { container.innerHTML = '<p style="text-align: center;">الأرشيف فارغ حالياً.</p>'; return; }

    container.innerHTML = `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>تاريخ التحويل</th>
                        <th>اسم المستلم</th>
                        <th>المبلغ</th>
                        <th>الآيبان</th>
                        <th>تاريخ الوردية</th>
                        <th>تم التحويل بواسطة</th>
                    </tr>
                </thead>
                <tbody>
                    ${archive.map(a => `
                        <tr>
                            <td>${new Date(a.paid_at).toLocaleString('ar-SA')}</td>
                            <td>${a.covering_guard_name}</td>
                            <td>${a.payment_amount} ر.س</td>
                            <td>${a.applicant_iban}</td>
                            <td>${new Date(a.shift_date).toLocaleDateString('ar-SA')}</td>
                            <td>${a.users.name}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// --- دالة مطورة لصفحة التوظيف ---
async function loadHolidaysPage() {
    const container = document.getElementById('holidays-list-container');
    container.innerHTML = '<p style="text-align: center;">جاري تحميل...</p>';

    const { data: holidays, error } = await supabaseClient
        .from('official_holidays')
        .select('*')
        .order('holiday_date', { ascending: false });

    if (error) {
        container.innerHTML = '<p style="color:red;">حدث خطأ في جلب العطلات.</p>';
        return console.error(error);
    }
    if (holidays.length === 0) {
        container.innerHTML = '<p style="text-align: center;">لا توجد عطلات مسجلة حالياً.</p>';
        return;
    }

    container.innerHTML = holidays.map(holiday => `
        <div class="attendance-card" style="padding: 15px; margin-bottom: 10px;">
            <div>
                <span>${holiday.description}</span>
                <p class="time">${new Date(holiday.holiday_date).toLocaleDateString('ar-SA')}</p>
            </div>
            <button class="btn-action delete-holiday-btn" data-id="${holiday.id}" title="حذف العطلة">
                <i class="ph-bold ph-trash"></i>
            </button>
        </div>
    `).join('');
}

// --- دالة صفحة التوظيف مع تفعيل السحب والإفلات والفلترة ---
async function loadHiringPage() {
    const vacanciesContainer = document.getElementById('hiring-vacancies-container');
    const historyContainer = document.getElementById('hiring-requests-history-container');

    vacanciesContainer.innerHTML = '<p>جاري تحميل الشواغر...</p>';
    historyContainer.innerHTML = '<p>جاري تحميل طلباتك...</p>';

    // جلب البيانات بشكل متوازي
    const [
        { data: vacancies, error: e1 },
        { data: requests, error: e2 }
    ] = await Promise.all([
        supabaseClient.from('job_vacancies').select('*').eq('status', 'open'),
        supabaseClient.from('employee_requests').select('*').eq('request_type', 'hiring').eq('user_id', currentUser.id).order('created_at', { ascending: false })
    ]);

    // 1. عرض الشواغر المفتوحة
    if (e1) {
        vacanciesContainer.innerHTML = '<p style="color:red;">خطأ في تحميل الشواغر.</p>';
    } else if (vacancies.length === 0) {
        vacanciesContainer.innerHTML = '<p>لا توجد شواغر مفتوحة حالياً.</p>';
    } else {
        vacanciesContainer.innerHTML = '';
        vacancies.forEach(vacancy => {
            const cardHtml = `
            <div class="contract-card">
                <div class="contract-card-header"><h4>${vacancy.title}</h4></div>
                <div class="contract-card-body">
                    <p><i class="ph-bold ph-map-pin"></i> ${vacancy.project} - ${vacancy.specific_location || vacancy.location}</p>
                </div>
                <div class="contract-card-footer">
                    <button class="btn btn-secondary btn-sm view-vacancy-details-btn" data-id="${vacancy.id}"><i class="ph-bold ph-info"></i> تفاصيل</button>
                    <button class="btn btn-success btn-sm add-to-coverage-btn" data-id="${vacancy.id}"><i class="ph-bold ph-shield-check"></i> للتغطية</button>
                    <button class="btn btn-primary btn-sm hire-new-btn" 
        data-vacancy-id="${vacancy.id}"
        data-project="${vacancy.project}"
        data-location="${vacancy.location}"
        data-region="${vacancy.region}"
        data-role="${vacancy.title}"
        data-contract-id="${vacancy.contract_id || ''}">
    <i class="ph-bold ph-user-plus"></i> توظيف جديد
</button>
                </div>
            </div>`;
            vacanciesContainer.insertAdjacentHTML('beforeend', cardHtml);
        });
    }

    // 2. عرض طلبات التوظيف المقدمة من هذا المستخدم
    if (e2) {
        historyContainer.innerHTML = '<p style="color:red;">خطأ في تحميل سجل الطلبات.</p>';
    } else if (requests.length === 0) {
        historyContainer.innerHTML = '<p>لم تقم بتقديم أي طلبات توظيف بعد.</p>';
    } else {
        historyContainer.innerHTML = `<div class="table-container"><table><thead><tr><th>اسم الموظف المقترح</th><th>المشروع</th><th>تاريخ الطلب</th><th>الحالة</th></tr></thead><tbody>
            ${requests.map(req => `
                <tr>
                    <td>${req.details.name}</td>
                    <td>${req.details.project}</td>
                    <td>${new Date(req.created_at).toLocaleDateString('ar-SA')}</td>
                    <td><span class="status ${req.status === 'مقبول' ? 'active' : (req.status === 'مرفوض' ? 'inactive' : 'pending')}">${req.status}</span></td>
                </tr>
            `).join('')}
        </tbody></table></div>`;
    }
}

// --- الخطوة 19: إعادة بناء واجهة التقارير ---
async function loadReportsPage() {
    const reportsContent = document.querySelector('#page-reports');
    // الهيكل المبدئي للصفحة مع رسالة تحميل
    reportsContent.innerHTML = `
        <div class="page-header">
            <h3>التقارير</h3>
        </div>
        <div class="report-filters-card">
            <p style="text-align: center;">جاري تحميل خيارات الفلترة...</p>
        </div>
        <div class="report-results-area">
            <p>سيتم عرض بيانات التقرير هنا بعد الضغط على "بحث".</p>
        </div>
    `;

    // جلب البيانات اللازمة لقوائم الفلاتر
    const [
        { data: supervisors, error: supError },
        { data: sites, error: siteError },
        { data: guards, error: guardError }
    ] = await Promise.all([
        supabaseClient.from('users').select('id, name').or('role.eq.مدير النظام,role.eq.مشرف'),
        supabaseClient.from('clients').select('id, name'),
        supabaseClient.from('users').select('id, name').eq('role', 'حارس أمن')
    ]);

    if (supError || siteError || guardError) {
        console.error('خطأ في جلب بيانات الفلاتر:', supError || siteError || guardError);
        document.querySelector('.report-filters-card').innerHTML = '<p>خطأ في تحميل خيارات الفلترة.</p>';
        return;
    }

    // دالة مساعدة لإنشاء خيارات القائمة المنسدلة
    const createOptions = (items) => items.map(item => `<option value="${item.id}">${item.name}</option>`).join('');

    // كود HTML النهائي لنموذج الفلاتر بعد جلب البيانات
    const filtersHtml = `
        <div class="filter-grid">
            <div class="filter-group">
                <label for="report-type">نوع التقرير</label>
                <select id="report-type">
                    <option value="attendance">تقرير الحضور والإنصراف</option>
                    <option value="client_sites">تقرير مواقع العملاء</option>
                    <option value="visits">تقرير الزيارات الميدانية</option>
                </select>
            </div>
            <div class="filter-group">
                <label for="date-from">من تاريخ</label>
                <input type="date" id="date-from">
            </div>
            <div class="filter-group">
                <label for="date-to">إلى تاريخ</label>
                <input type="date" id="date-to">
            </div>
            <div class="filter-group">
                <label for="supervisor-select">المشرف</label>
                <select id="supervisor-select">
                    <option value="">الكل</option>
                    ${createOptions(supervisors)}
                </select>
            </div>
            <div class="filter-group">
                <label for="site-select">الموقع</label>
                <select id="site-select">
                    <option value="">الكل</option>
                    ${createOptions(sites)}
                </select>
            </div>
            <div class="filter-group">
                <label for="guard-select">الحارس</label>
                <select id="guard-select">
                    <option value="">الكل</option>
                    ${createOptions(guards)}
                </select>
            </div>
        </div>
        <div class="report-actions">
            <button class="btn btn-primary"><i class="ph-bold ph-magnifying-glass"></i> بحث</button>
            <button class="btn btn-secondary" style="background-color: #d9534f; color: white;"><i class="ph-bold ph-file-pdf"></i> تصدير PDF</button>
        </div>
    `;

    document.querySelector('.report-filters-card').innerHTML = filtersHtml;
}
// ------------------------------------

// --- دالة لجلب وعرض الإحصائيات ---
// --- دالة الإحصائيات المحصّنة والآمنة ---
async function fetchStatistics() {
    // دالة مساعدة صغيرة لتحديث النص بأمان
    const safeUpdate = (selector, value) => {
        const element = document.querySelector(selector);
        if (element) { // يتحقق أولاً إذا كان العنصر موجوداً قبل محاولة التعديل
            element.textContent = value;
        }
    };

    // جلب البيانات من قاعدة البيانات
    const [
        { count: clientsCount, error: e1 },
        { count: usersCount, error: e2 },
        { count: visitsCount, error: e3 },
        { count: schedulesCount, error: e4 }
    ] = await Promise.all([
        supabaseClient.from('clients').select('*', { count: 'exact', head: true }),
        supabaseClient.from('users').select('*', { count: 'exact', head: true }),
        supabaseClient.from('visits').select('*', { count: 'exact', head: true }),
        supabaseClient.from('schedules').select('*', { count: 'exact', head: true })
    ]);

    if (e1 || e2 || e3 || e4) {
        console.error("خطأ في جلب الإحصائيات:", e1 || e2 || e3 || e4);
    }

    // تحديث الواجهة بأمان (لن يتوقف البرنامج بعد الآن)
    safeUpdate('#stats-clients h3', clientsCount || 0);
    safeUpdate('#stats-users h3', usersCount || 0);
    safeUpdate('#stats-visits h3', visitsCount || 0);
    safeUpdate('#stats-schedules h3', schedulesCount || 0);
}
// ------------------------------------


// ------------------------------------
// =========================================================================
// --- هذا الكود يحل محل كل الكود التفاعلي في نهاية الملف ---

document.addEventListener('DOMContentLoaded', function() {


// --- منطق صفحة استيراد العقود ---
// --- منطق صفحة استيراد العقود ---
const importContractsBtn = document.getElementById('import-contracts-btn');
const contractFileInput = document.getElementById('contract-import-input');

if (importContractsBtn && contractFileInput) {
    importContractsBtn.addEventListener('click', () => {
        const userChoice = confirm("هل تريد تحميل القالب أم رفع ملف؟\n\nاضغط 'OK' لتحميل القالب.\nاضغط 'Cancel' لرفع ملف موجود.");
        if (userChoice) {
            // إذا اختار المستخدم "موافق"، قم بتحميل القالب
            downloadContractTemplate();
        } else {
            // إذا اختار المستخدم "إلغاء"، قم بفتح نافذة اختيار الملف
            contractFileInput.click();
        }
    });

    contractFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            processContractFile(file);
        }
    });
}

// تعديل بسيط على زر إضافة عقد جديد ليعمل مع الزر الجديد
const addContractBtn = document.getElementById('add-contract-btn');
if(addContractBtn) {
    addContractBtn.addEventListener('click', () => {
        // هذا الكود موجود بالفعل لديك في مكان آخر، فقط نتأكد من وجود المستمع
        // يمكنك ترك هذا فارغًا إذا كان الكود موجودًا بالفعل
    });
}



// ==========================================================
// ===            بداية منطق حفظ الإعلانات              ===
// ==========================================================
document.getElementById('announcement-form')?.addEventListener('submit', async function(event) {
    event.preventDefault();
    const saveBtn = document.getElementById('save-announcement-btn');
    saveBtn.disabled = true;

    const annId = document.getElementById('announcement-id').value;
    const annData = {
        title: document.getElementById('announcement-title').value,
        content: document.getElementById('announcement-content').value,
        type: document.getElementById('announcement-type').value,
        start_date: new Date(document.getElementById('announcement-start-date').value).toISOString(),
        end_date: new Date(document.getElementById('announcement-end-date').value).toISOString(),
        is_active: true,
        created_by: currentUser.name
    };

    const { error } = annId
        ? await supabaseClient.from('announcements').update(annData).eq('id', annId)
        : await supabaseClient.from('announcements').insert(annData);

    if (error) {
        alert('حدث خطأ: ' + error.message);
    } else {
        alert('تم حفظ الإعلان بنجاح.');
        loadAnnouncementsPage(); // تحديث القائمة والنموذج
    }
    saveBtn.disabled = false;
});
// ==========================================================
// ===             نهاية منطق حفظ الإعلانات               ===
// ==========================================================


// بداية الإضافة: التحقق من وجود جلسة مدير محفوظة
if (localStorage.getItem('admin_session')) {
    document.getElementById('return-to-admin-banner').classList.remove('hidden');
    // إضافة هامش علوي للمحتوى الرئيسي لتجنب تداخله مع الشريط
    document.querySelector('.main-content').style.paddingTop = '60px';
}
// نهاية الإضافة

    // بداية الإضافة: إظهار حقل مبلغ التأمينات عند الحاجة
document.addEventListener('change', (event) => {
    if (event.target.id === 'employee-insurance') {
        const amountGroup = document.getElementById('insurance-amount-group');
        if (event.target.value === 'مسجل') {
            amountGroup.classList.remove('hidden');
        } else {
            amountGroup.classList.add('hidden');
            document.getElementById('employee-insurance-amount').value = 0;
        }
    }
});
// نهاية الإضافة

const penaltySearchInput = document.getElementById('penalty-employee-search');
    if(penaltySearchInput) {
        penaltySearchInput.addEventListener('keyup', () => {
            loadPenaltiesPage(penaltySearchInput.value);
        });
    }

    // --- إضافة أيقونة لزر القائمة في الجوال ---
const menuBtn = document.getElementById('menu-toggle-btn');
if (menuBtn) {
    menuBtn.innerHTML = '<i class="ph-bold ph-list"></i>';
}
    // بداية الإضافة: ربط فلاتر صفحة سجل الحضور

// نهاية الإضافة
    
    // --- بداية الإضافة: تفعيل فلاتر صفحة الموظفين ---
    const employeeSearchInput = document.getElementById('employee-search-input');
    const employeeRoleFilter = document.getElementById('employee-role-filter');
    const employeeProjectFilter = document.getElementById('employee-project-filter');

    if(employeeSearchInput) {
        employeeSearchInput.addEventListener('keyup', () => {
            // نتأكد من وجود الدالة قبل استدعائها
            if (typeof loadEmployeeTabData === 'function') {
                loadEmployeeTabData();
            }
        });
    }
    if(employeeRoleFilter) {
        employeeRoleFilter.addEventListener('change', () => {
            if (typeof loadEmployeeTabData === 'function') {
                loadEmployeeTabData();
            }
        });
    }
    if(employeeProjectFilter) {
        employeeProjectFilter.addEventListener('keyup', () => {
            if (typeof loadEmployeeTabData === 'function') {
                loadEmployeeTabData();
            }
        });
    }
    // --- نهاية الإضافة ---


    console.log('DOM fully loaded and parsed. Initializing listeners.');
    // --- NEW: Check for existing session ---
    // --- NEW: Check for existing session ---
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
        // إذا وجدنا مستخدم محفوظ، نستخدم بياناته
        currentUser = JSON.parse(savedUser);
        
        // تحديث الواجهة بناءً على دور المستخدم المحفوظ
        updateUIVisibility(currentUser.role);
        
        // إخفاء صفحة تسجيل الدخول وإظهار لوحة التحكم
        document.getElementById('login-page').style.display = 'none';
        document.querySelector('.dashboard-container').classList.remove('hidden');
        
        // تحديث رسالة الترحيب
        const userProfileSpan = document.querySelector('.user-profile span');
        if (userProfileSpan) userProfileSpan.textContent = `مرحباً، ${currentUser.name}`;

        displayActiveAnnouncements(); // <-- هذا هو السطر الجديد والمهم

        // افتح الصفحة الأولى المتاحة (أو الصفحة المحفوظة في الرابط، سنتعامل معها في الخطوة 3)
        const lastPageId = sessionStorage.getItem('lastVisitedPage');
        let pageToOpenLink = null;

        // تحقق إذا كان هناك صفحة محفوظة
        if (lastPageId) {
            // حاول العثور على رابط الصفحة المحفوظة
            pageToOpenLink = document.querySelector(`.sidebar-nav a[data-page="${lastPageId}"]`);
            // تأكد من أن الرابط موجود وأن المستخدم يملك صلاحية رؤيته
            if (pageToOpenLink && pageToOpenLink.parentElement.style.display !== 'none') {
                // تم العثور على صفحة صالحة، سيتم فتحها
            } else {
                // إذا كانت الصفحة المحفوظة غير صالحة (مثلاً تم تغيير صلاحيات المستخدم)، تجاهلها
                pageToOpenLink = null;
            }
        }

        // إذا لم نجد صفحة صالحة محفوظة، نعود للخيار الافتراضي (فتح أول صفحة في القائمة)
        if (!pageToOpenLink) {
            pageToOpenLink = document.querySelector('.sidebar-nav li[style*="display: block"] a');
        }

        // أخيراً، قم بفتح الصفحة التي تم تحديدها
        if (pageToOpenLink) {
            pageToOpenLink.click();
        }
    }
    // --- END: Check for existing session ---

    // --- 1. منطق التنقل بين الصفحات ---
    const navLinks = document.querySelectorAll('.sidebar-nav a');
    const pageContents = document.querySelectorAll('.page-content');
    const mainTitle = document.getElementById('main-title');

    // ==================== بداية الاستبدال ====================
// ==========================================================
// ===   بداية الاستبدال الكامل لمنطق التنقل بين الصفحات   ===
// ==========================================================
// دالة جديدة ومهمة لإعادة جلب بيانات المستخدم الحالي من قاعدة البيانات
async function refreshCurrentUser() {
    if (currentUser && currentUser.id) {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .single();
        if (data) {
            currentUser = data;
            sessionStorage.setItem('currentUser', JSON.stringify(data)); // تحديث البيانات المحفوظة
            console.log("User data refreshed:", currentUser);
        }
    }
}

navLinks.forEach(link => {
    link.addEventListener('click', async function(event) { // تم تحويلها إلى async
        event.preventDefault();
        
        // --- هنا تم إضافة السطر الجديد والمهم ---
        await refreshCurrentUser(); // نضمن تحديث بيانات المستخدم قبل فتح أي صفحة

        const targetPageId = this.dataset.page;
        if (!targetPageId) return;

        sessionStorage.setItem('lastVisitedPage', targetPageId);

        if (mapSubscription) {
            supabaseClient.removeChannel(mapSubscription);
            mapSubscription = null;
        }
        if (requestsSubscription) {
            supabaseClient.removeChannel(requestsSubscription);
            requestsSubscription = null;
        }

        mainTitle.textContent = this.querySelector('span').textContent;
        navLinks.forEach(navLink => navLink.classList.remove('active'));
        this.classList.add('active');
        pageContents.forEach(page => page.classList.add('hidden'));

        const targetPage = document.getElementById(targetPageId);
        if (targetPage) {
            targetPage.classList.remove('hidden');
        }

        // استدعاء الدوال الخاصة بكل صفحة (هذا الجزء يبقى كما هو)
        if (targetPageId === 'page-clients') fetchClients();
        if (targetPageId === 'page-users') fetchUsers();
        if (targetPageId === 'page-jobs') fetchJobs();
        if (targetPageId === 'page-geo') initializeMap();
        if (targetPageId === 'page-schedules') fetchSchedules();
        if (targetPageId === 'page-coverage') loadCoveragePage();
        if (targetPageId === 'page-visits') fetchVisits();
        if (targetPageId === 'page-reports') loadReportsPage();
        if (targetPageId === 'page-attendance') loadAttendancePage();
        if (targetPageId === 'page-guard-attendance') loadGuardAttendancePage();
        if (targetPageId === 'page-patrol') loadSupervisorPatrolPage();
        if (targetPageId === 'page-contracts') fetchContracts();
        if (targetPageId === 'page-vacancies') loadVacancyTabData();
        if (targetPageId === 'page-employees') loadEmployeeTabData();
        if (targetPageId === 'page-requests-review') loadRequestsReviewPage();
        if (targetPageId === 'page-hiring') loadHiringPage();
        if (targetPageId === 'page-penalties') loadPenaltiesPage();
        if (targetPageId === 'page-coverage-requests') loadCoverageRequestsPage();
        if (targetPageId === 'page-directives-ops') loadOpsDirectivesPage();
        if (targetPageId === 'page-my-directives') loadMyDirectivesPage();
        if (targetPageId === 'page-my-visits') loadMyVisitsPage();
        if (targetPageId === 'page-my-schedule') loadMySchedulePage();
        if (targetPageId === 'page-ops-review-requests') loadOpsReviewRequestsPage();
        if (targetPageId === 'page-announcements') loadAnnouncementsPage();
        if (targetPageId === 'page-supervisor-schedules') loadSupervisorSchedulesPage();
        if (targetPageId === 'page-supervisor-permission-requests') loadSupervisorPermissionRequestsPage();
        if (targetPageId === 'page-supervisor-applications') loadSupervisorApplicationsPage();
        if (targetPageId === 'page-ops-nominees') loadOpsNomineesPage();
        if (targetPageId === 'page-admin-dashboard') loadAdminDashboardPage();
        if (targetPageId === 'page-supervisor-coverage-apps') loadSupervisorCoverageAppsPage();
        if (targetPageId === 'page-hr-ops-hiring') loadHrOpsHiringPage();
        if (targetPageId === 'page-user-management') loadUserManagementPage();
        if (targetPageId === 'page-finance-coverage') loadFinanceCoveragePage();
        if (targetPageId === 'page-official-holidays') loadHolidaysPage();
        if (targetPageId === 'page-operations-requests') loadOperationsRequestsPage();
        if (targetPageId === 'page-my-profile') loadMyProfilePage();
        if (targetPageId === 'page-leave-requests') loadLeaveRequests();
        if (targetPageId === 'page-requests-archive') loadArchivePage('leave');
        if (targetPageId === 'page-resignation-requests') loadResignationRequests();
        if (targetPageId === 'page-loan-requests') loadLoanRequests();
        if (targetPageId === 'page-hr-attendance-log') loadHrAttendanceLogPage();
        if (targetPageId === 'page-payroll') {
            document.getElementById('payroll-results-container').innerHTML = '<p style="text-align: center;">الرجاء اختيار الشهر والضغط على "توليد المسير" لعرض البيانات.</p>';
        }
        if (targetPageId === 'page-hr-data-entry') {
            document.getElementById('import-results-container').innerHTML = '';
        }

        if (targetPageId === 'page-my-requests') {
            loadMyRequestsPage();
            requestsSubscription = supabaseClient.channel('public:employee_requests:my_requests')
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'employee_requests',
                    filter: `user_id=eq.${currentUser.id}`
                }, payload => {
                    loadMyRequestsPage();
                })
                .subscribe();
        }

        if (targetPageId === 'page-permission-requests') {
            loadPermissionRequests();
            requestsSubscription = supabaseClient.channel('public:employee_requests:all_permissions')
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'employee_requests',
                    filter: 'request_type=eq.permission'
                }, payload => {
                    loadPermissionRequests();
                })
                .subscribe();
        }
    });
});
// ==========================================================
// ===    نهاية الاستبدال الكامل لمنطق التنقل بين الصفحات    ===
// ==========================================================

// ===================== نهاية الاستبدال =====================



// بداية الاستبدال
// منطق الملء التلقائي الذكي لجميع النماذج (شواغر وموظفين)
document.addEventListener('change', async (event) => {

// --- منطق إظهار حقول الصلاحيات للمدراء والمشرفين ---
    if (event.target.id === 'employee-role') {
        const role = event.target.value;
        const assignmentGroup = document.getElementById('manager-assignment-group');
        const regionGroup = document.getElementById('assign-region-group');
        const projectGroup = document.getElementById('assign-project-group');

        assignmentGroup.classList.add('hidden');
        regionGroup.classList.add('hidden');
        projectGroup.classList.add('hidden');

        if (role === 'ادارة العمليات') {
            assignmentGroup.classList.remove('hidden');
            regionGroup.classList.remove('hidden');
        } else if (role === 'مشرف') {
            assignmentGroup.classList.remove('hidden');
            projectGroup.classList.remove('hidden');
            
            // --- هنا تم التصحيح الكامل ---
            const projectContainer = document.getElementById('assign-project-checkbox-container');
            projectContainer.innerHTML = '<p>جاري تحميل المشاريع...</p>'; // رسالة تحميل مؤقتة
            
            const { data: contracts } = await supabaseClient.from('contracts').select('company_name');
            
            if (contracts) {
                const projectNames = [...new Set(contracts.map(c => c.company_name))];
                // بناء مربعات الاختيار داخل الحاوية الصحيحة
                projectContainer.innerHTML = `
                    <div class="checkbox-grid">
                        ${projectNames.map(p => `<label><input type="checkbox" value="${p}"> ${p}</label>`).join('')}
                    </div>
                `;
            } else {
                projectContainer.innerHTML = '<p>لم يتم العثور على مشاريع.</p>';
            }
            // --- نهاية التصحيح الكامل ---
        }
    }

// --- عند تغيير الشاغر في نافذة تعديل الموظف (النسخة المصححة) ---
    if (event.target.id === 'employee-vacancy') {
        const vacancyId = event.target.value;
        
        // الوصول إلى كل الحقول التي سنقوم بتحديثها
        const regionInput = document.getElementById('employee-region');
        const cityInput = document.getElementById('employee-city');
        const projectDisplay = document.getElementById('employee-project-display');
        const locationDisplay = document.getElementById('employee-location-display');
        const shiftDisplay = document.getElementById('employee-shift-display');

        // 1. إفراغ الحقول أولاً
        regionInput.value = '';
        cityInput.value = '';
        projectDisplay.value = '';
        locationDisplay.value = '';
        shiftDisplay.value = 'الرجاء اختيار شاغر';

        if (vacancyId) {
            // 2. جلب كل بيانات الشاغر المحدد
            const { data: vacancy, error } = await supabaseClient
                .from('job_vacancies').select(`*`).eq('id', vacancyId).single();
            
            if (vacancy) {
    // 3. تعبئة كل الحقول مباشرةً من بيانات الشاغر
    regionInput.value = vacancy.region || '';
    cityInput.value = vacancy.location || ''; // "location" هو حقل المدينة في جدول الشواغر
    projectDisplay.value = vacancy.project || '';
    locationDisplay.value = vacancy.specific_location || '';

    // --- هذا هو السطر الجديد والمهم لإصلاح المشكلة ---
    contractSelect.value = vacancy.contract_id || '';

    const shift = vacancy.schedule_details?.[0];
    if (shift) {
        shiftDisplay.value = `${shift.name || 'وردية'} (من ${formatTimeAMPM(shift.start_time)} إلى ${formatTimeAMPM(shift.end_time)})`;
    } else {
        shiftDisplay.value = 'لا توجد تفاصيل وردية لهذا الشاغر';
    }
}
        }
    }

// --- منطق الملء التلقائي في نافذة "إضافة شاغر" (النسخة الجديدة) ---
    if (event.target.id === 'vacancy-contract') {
        const contractId = event.target.value;
        const locationGroup = document.getElementById('vacancy-location-group');
        const shiftGroup = document.getElementById('vacancy-shift-group');
        const projectInput = document.getElementById('vacancy-project');
        const cityInput = document.getElementById('vacancy-city'); // تم استخدام الـ ID الجديد
        const locationSelect = document.getElementById('vacancy-location-select');
        const shiftSelect = document.getElementById('vacancy-shift-select');

        // إخفاء وإفراغ كافة الحقول التابعة
        locationGroup.classList.add('hidden');
        shiftGroup.classList.add('hidden');
        projectInput.value = '';
        if (cityInput) cityInput.value = '';
        locationSelect.innerHTML = '';
        shiftSelect.innerHTML = '';

        if (!contractId) return; // الخروج إذا لم يتم اختيار عقد

        try {
            const { data: contract, error } = await supabaseClient
                .from('contracts').select('company_name, city, contract_locations').eq('id', contractId).single();
            
            if (error || !contract) throw new Error('خطأ في جلب بيانات العقد.');

            // تعبئة الحقول تلقائياً
            projectInput.value = contract.company_name;
            if (cityInput) cityInput.value = (contract.city || []).join('، ');

            if (contract.contract_locations && contract.contract_locations.length > 0) {
                locationSelect.innerHTML = '<option value="">-- اختر موقعاً --</option>';
                contract.contract_locations.forEach(loc => {
                    locationSelect.innerHTML += `<option value="${loc.name}">${loc.name}</option>`;
                });
                locationGroup.classList.remove('hidden');
            }
        } catch (err) {
            console.error(err.message);
            alert('حدث خطأ أثناء تحميل تفاصيل العقد.');
        }
    }

    if (event.target.id === 'vacancy-location-select') {
        const locationName = event.target.value;
        const contractId = document.getElementById('vacancy-contract').value;
        const shiftGroup = document.getElementById('vacancy-shift-group');
        const shiftSelect = document.getElementById('vacancy-shift-select');

        shiftGroup.classList.add('hidden');
        shiftSelect.innerHTML = '';

        if (!locationName || !contractId) return;

        const { data: contract, error } = await supabaseClient
            .from('contracts').select('contract_locations').eq('id', contractId).single();
            
        if (error) return;

        const selectedLocation = contract.contract_locations.find(loc => loc.name === locationName);
        
        if (selectedLocation && selectedLocation.shifts && selectedLocation.shifts.length > 0) {
            shiftSelect.innerHTML = '<option value="">-- اختر وردية --</option>';
            selectedLocation.shifts.forEach((shift, index) => {
                const shiftLabel = `${shift.name || `وردية ${index + 1}`} (من ${shift.start_time || '؟'} إلى ${shift.end_time || '؟'})`;
                shiftSelect.innerHTML += `<option value='${JSON.stringify(shift)}'>${shiftLabel}</option>`;
            });
            shiftGroup.classList.remove('hidden');
        }
    }

    // بداية الإضافة: الملء التلقائي في نافذة إنشاء التغطية
if (event.target.id === 'coverage-link-vacancy') {
    const vacancyId = event.target.value;
    const projectInput = document.getElementById('coverage-new-project');
    const locationInput = document.getElementById('coverage-new-location');
    const regionInput = document.getElementById('coverage-new-region');
    const cityInput = document.getElementById('coverage-new-city');
    const inputs = [projectInput, locationInput, regionInput, cityInput];
    
    // إعادة تعيين الحقول
    inputs.forEach(input => {
        input.value = '';
        input.disabled = false;
    });

    if (vacancyId) {
        // جلب بيانات الشاغر المحدد
        const { data: vacancy, error } = await supabaseClient
            .from('job_vacancies')
            .select('project, specific_location, region, location') // "location" هنا هو المدينة
            .eq('id', vacancyId)
            .single();
            
        if (vacancy) {
            projectInput.value = vacancy.project || '';
            locationInput.value = vacancy.specific_location || '';
            regionInput.value = vacancy.region || '';
            cityInput.value = vacancy.location || ''; // "location" هو المدينة
            // جعل الحقول غير قابلة للتعديل عند الربط بشاغر
            inputs.forEach(input => input.disabled = true);
        }
    }
}
// نهاية الإضافة

    // --- أولاً: منطق الملء التلقائي في نافذة "إضافة شاغر" ---
    if (event.target.id === 'vacancy-contract') {
        const contractId = event.target.value;
        const locationGroup = document.getElementById('vacancy-location-group');
        const shiftGroup = document.getElementById('vacancy-shift-group');
        const projectInput = document.getElementById('vacancy-project');
        const cityInput = document.getElementById('vacancy-city'); // استخدام الـ ID الصحيح
        const locationSelect = document.getElementById('vacancy-location-select');
        const shiftSelect = document.getElementById('vacancy-shift-select');

        // إفراغ كافة الحقول التابعة عند تغيير العقد
        locationGroup.classList.add('hidden');
        shiftGroup.classList.add('hidden');
        projectInput.value = '';
        if (cityInput) cityInput.value = '';
        locationSelect.innerHTML = '';
        shiftSelect.innerHTML = '';

        if (!contractId) return;

        try {
            const { data: contract, error } = await supabaseClient
                .from('contracts').select('company_name, city, contract_locations').eq('id', contractId).single();
            
            if (error || !contract) throw new Error('خطأ في جلب بيانات العقد.');

            // تعبئة الحقول تلقائياً بالبيانات الصحيحة
            projectInput.value = contract.company_name;
            if (cityInput) cityInput.value = (contract.city || []).join('، ');

            if (contract.contract_locations && contract.contract_locations.length > 0) {
                locationSelect.innerHTML = '<option value="">-- اختر موقعاً --</option>';
                contract.contract_locations.forEach(loc => {
                    locationSelect.innerHTML += `<option value="${loc.name}">${loc.name}</option>`;
                });
                locationGroup.classList.remove('hidden');
            }
        } catch (err) {
            console.error(err.message);
            alert('حدث خطأ أثناء تحميل تفاصيل العقد.');
        }
    }
// --- ثانياً: منطق الملء التلقائي في نافذة "إضافة/تعديل موظف" (تحديث جديد) ---
    if (event.target.id === 'employee-contract' || event.target.id === 'employee-vacancy') {
        const contractSelect = document.getElementById('employee-contract');
        const vacancySelect = document.getElementById('employee-vacancy');
        const regionInput = document.getElementById('employee-region');
        const cityInput = document.getElementById('employee-city');
        const projectDisplay = document.getElementById('employee-project-display');
        const locationDisplay = document.getElementById('employee-location-display');
        // --- إضافة الحقول الجديدة للورديات ---
        const shiftGroup = document.getElementById('employee-shift-group');
        const shiftSelect = document.getElementById('employee-shift');

        // إخفاء قائمة الورديات مبدئياً
        shiftGroup.classList.add('hidden');
        shiftSelect.innerHTML = '';

        const vacancyId = vacancySelect.value;
        const contractId = contractSelect.value;

        if (vacancyId) {
            const { data: vacancy, error } = await supabaseClient
                .from('job_vacancies').select(`*, contracts(*)`).eq('id', vacancyId).single();
                
            if (vacancy) {
                regionInput.value = vacancy.region || '';
                cityInput.value = vacancy.location || '';
                projectDisplay.value = vacancy.project || '';
                locationDisplay.value = vacancy.specific_location || '';
                contractSelect.value = vacancy.contract_id || '';

                // --- جلب وعرض الورديات المتاحة لهذا الموقع ---
                const contractDetails = vacancy.contracts;
                if (contractDetails && contractDetails.locations_and_guards) {
                    const locationData = contractDetails.locations_and_guards.find(l => l.location_name === vacancy.specific_location);
                    if (locationData && locationData.shifts) {
                        shiftSelect.innerHTML = '<option value="">-- اختر وردية --</option>';
                        locationData.shifts.forEach((shift, index) => {
                            const shiftLabel = `من ${shift.start_time || '؟'} إلى ${shift.end_time || '؟'} (${shift.days.join(', ')})`;
                            // نستخدم JSON.stringify لحفظ بيانات الوردية كاملة
                            shiftSelect.innerHTML += `<option value='${JSON.stringify(shift)}'>${shiftLabel}</option>`;
                        });
                        shiftGroup.classList.remove('hidden'); // إظهار قائمة الورديات
                    }
                }
            }
        } else if (contractId) {
            // إذا لم يتم تحديد شاغر، نعتمد على العقد
            const { data: contract, error } = await supabaseClient
                .from('contracts').select('region, city, company_name').eq('id', contractId).single();
            if (contract) {
                regionInput.value = contract.region || '';
                cityInput.value = contract.city || '';
                projectDisplay.value = contract.company_name || '';
                locationDisplay.value = 'غير محدد';
            }
        } else {
            // إذا لم يتم تحديد أي منهما، أفرغ الحقول
            regionInput.value = ''; cityInput.value = '';
            projectDisplay.value = ''; locationDisplay.value = '';
        }
    }
});
// نهاية الاستبدال
    // --- 2. منطق الأزرار والنوافذ المنبثقة (باستخدام تفويض الأحداث) ---
    // --- 3. Listener for All Body Clicks (Modals & Actions) ---
// --- 3. Master Click Handler for the entire application ---
document.body.addEventListener('click', async function(event) {

// ==========================================================
// ===        بداية منطق أزرار صفحة إدارة الإعلانات        ===
// ==========================================================
// --- زر تعديل إعلان ---
const editAnnBtn = event.target.closest('.edit-announcement-btn');
if (editAnnBtn) {
    const annId = editAnnBtn.dataset.id;
    const { data, error } = await supabaseClient.from('announcements').select('*').eq('id', annId).single();
    if (data) {
        document.getElementById('announcement-id').value = data.id;
        document.getElementById('announcement-title').value = data.title || ''; // <-- السطر الجديد
        document.getElementById('announcement-content').value = data.content;
        document.getElementById('announcement-type').value = data.type;
        // ... (باقي الكود)
        // تحويل التوقيت ليتوافق مع حقل الإدخال
        const toLocalISOString = (date) => new Date(new Date(date).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        document.getElementById('announcement-start-date').value = toLocalISOString(data.start_date);
        document.getElementById('announcement-end-date').value = toLocalISOString(data.end_date);
        window.scrollTo({ top: 0, behavior: 'smooth' }); // الصعود لأعلى الصفحة
    }
}

// --- زر حذف إعلان ---
const deleteAnnBtn = event.target.closest('.delete-announcement-btn');
if (deleteAnnBtn) {
    if (confirm('هل أنت متأكد من حذف هذا الإعلان نهائياً؟')) {
        const annId = deleteAnnBtn.dataset.id;
        await supabaseClient.from('announcements').delete().eq('id', annId);
        loadAnnouncementsPage(); // تحديث القائمة
    }
}

// --- زر إلغاء التعديل (تنظيف النموذج) ---
const clearAnnFormBtn = event.target.closest('#clear-announcement-form');
if (clearAnnFormBtn) {
    document.getElementById('announcement-form').reset();
    document.getElementById('announcement-id').value = '';
}
// ==========================================================
// ===         نهاية منطق أزرار صفحة إدارة الإعلانات         ===
// ==========================================================


// --- منطق زر إتمام الدفع والأرشفة ---
const finalizePaymentBtn = event.target.closest('.finalize-payment-btn');
if (finalizePaymentBtn) {
    const paymentId = finalizePaymentBtn.dataset.paymentId;
    if (confirm('هل أنت متأكد؟ سيتم أرشفة هذه الدفعة وحذف حساب الموظف المؤقت بشكل نهائي.')) {
        finalizePaymentBtn.disabled = true;
        finalizePaymentBtn.innerHTML = '<i class="ph-fill ph-spinner-gap animate-spin"></i>';

        const { data, error } = await supabaseClient.functions.invoke('finalize-coverage-payment', {
            body: { payment_id: paymentId }
        });

        if (error || data.error) {
            showToast(error?.message || data.error, 'error');
        } else {
            showToast('تمت أرشفة الدفعة وحذف المستخدم بنجاح.', 'success');
            loadFinancePendingPage(); // تحديث قائمة الانتظار
        }
        
        finalizePaymentBtn.disabled = false;
        finalizePaymentBtn.innerHTML = '<i class="ph-bold ph-check-circle"></i> تم التحويل والأرشفة';
    }
}



// --- عند الضغط على زر "اعتماد وإرسال للمالية" ---
const approveForFinanceBtn = event.target.closest('.ops-approve-completed-coverage-btn');
if (approveForFinanceBtn) {
    const paymentId = approveForFinanceBtn.dataset.paymentId;
    if (confirm('هل أنت متأكد من اعتماد هذه التغطية وإرسالها للمالية؟')) {
        approveForFinanceBtn.disabled = true;
        const { error } = await supabaseClient
            .from('coverage_payments')
            .update({ status: 'pending_finance_transfer' })
            .eq('id', paymentId);
        
        if (error) {
            showToast('حدث خطأ أثناء الاعتماد.', 'error');
        } else {
            showToast('تم اعتماد التغطية وإرسالها للمالية بنجاح.', 'success');
            loadCompletedCoveragesForApproval(); // تحديث القائمة
        }
        approveForFinanceBtn.disabled = false;
    }
}
// --- منطق تعديل وحذف التغطيات ---

// عند الضغط على زر "حذف تغطية"
// عند الضغط على زر "حذف تغطية"
const deleteCoverageBtn = event.target.closest('.delete-coverage-btn');
if (deleteCoverageBtn) {
    const shiftId = deleteCoverageBtn.dataset.shiftId;
    if (confirm('هل أنت متأكد من حذف هذه التغطية بشكل نهائي؟')) {
        // --- بداية الإضافة: جلب بيانات التغطية قبل الحذف ---
        const { data: shiftToDelete, error: fetchError } = await supabaseClient
            .from('coverage_shifts')
            .select('linked_vacancy_id')
            .eq('id', shiftId)
            .single();
        // --- نهاية الإضافة ---

        const { error } = await supabaseClient.from('coverage_shifts').delete().eq('id', shiftId);
        if (error) {
            showToast('حدث خطأ أثناء الحذف.', 'error');
        } else {
            // --- بداية الإضافة: إعادة فتح الشاغر إذا كان مرتبطاً ---
            if (fetchError === null && shiftToDelete && shiftToDelete.linked_vacancy_id) {
                await supabaseClient
                    .from('job_vacancies')
                    .update({ is_temporarily_covered: false })
                    .eq('id', shiftToDelete.linked_vacancy_id);
            }
            // --- نهاية الإضافة ---
            showToast('تم حذف التغطية بنجاح.', 'success');
            await supabaseClient.from('audit_logs').insert({ user_name: currentUser.name, action_type: 'حذف تغطية', details: { deleted_shift_id: shiftId } });
            loadCoveragePage();
        }
    }
}

// عند الضغط على زر "تعديل تغطية"
const editCoverageBtn = event.target.closest('.edit-coverage-btn');
if (editCoverageBtn) {
    const shiftId = editCoverageBtn.dataset.shiftId;
    const { data: shift, error } = await supabaseClient.from('coverage_shifts').select('*').eq('id', shiftId).single();

    if (error || !shift) {
        return showToast('حدث خطأ في جلب بيانات التغطية.', 'error');
    }

    const modal = document.getElementById('create-coverage-modal');
    
    // تعبئة الفورم ببيانات التغطية الحالية
    document.getElementById('coverage-edit-id').value = shift.id;
    document.getElementById('coverage-new-project').value = shift.project;
    document.getElementById('coverage-new-location').value = shift.location;
    document.getElementById('coverage-new-region').value = shift.region;
    document.getElementById('coverage-new-city').value = shift.city;
    document.getElementById('coverage-new-start-time').value = shift.start_time;
    document.getElementById('coverage-new-end-time').value = shift.end_time;
    document.getElementById('coverage-new-pay').value = shift.coverage_pay;
    document.getElementById('coverage-new-reason').value = shift.reason;
    
    const vacancySelect = document.getElementById('coverage-link-vacancy');
    vacancySelect.disabled = true;
    vacancySelect.innerHTML = `<option value="">${shift.linked_vacancy_id ? 'مرتبطة بشاغر (لا يمكن التغيير)' : 'غير مرتبطة بشاغر'}</option>`;
    
    modal.classList.remove('hidden');
}

// --- منطق زر "عرض في الخريطة" ---
const viewOnMapBtn = event.target.closest('.view-on-map-btn');
if (viewOnMapBtn) {
    const guardId = viewOnMapBtn.dataset.guardId;
    // نخزن هوية الحارس المطلوب في متغير مؤقت
    window.zoomToGuardId = guardId;
    // نقوم بمحاكاة الضغط على رابط الخريطة في القائمة الجانبية للانتقال إليها
    document.querySelector('a[data-page="page-geo"]').click();
}


// --- منطق تعديل الحضور من قبل مدير النظام (نسخة مطورة) ---

// فتح النافذة (من سجل الحضور أو صفحة المتابعة)
const editAttendanceBtn = event.target.closest('.admin-edit-attendance-btn, .admin-manual-attendance-btn');
if (editAttendanceBtn) {
    const attendanceId = editAttendanceBtn.dataset.id; // قد يكون غير موجود
    const guardId = editAttendanceBtn.dataset.guardId; // قد يكون غير موجود
    const guardName = editAttendanceBtn.dataset.name;
    const modal = document.getElementById('admin-edit-attendance-modal');

    document.getElementById('edit-attendance-title').textContent = `تعديل سجل: ${guardName}`;
    
    // إعادة تعيين الحقول
    document.getElementById('edit-attendance-id').value = '';
    document.getElementById('edit-attendance-status').value = 'حاضر';
    document.getElementById('edit-checkin-time').value = '';
    document.getElementById('edit-checkout-time').value = '';

    // دالة مساعدة لتحويل التوقيت
    const toLocalISOString = (date) => {
        if (!date) return '';
        const d = new Date(date);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    };

    let record;
    if (attendanceId) { // إذا جئنا من صفحة سجل الحضور
        const { data } = await supabaseClient.from('attendance').select('*').eq('id', attendanceId).single();
        record = data;
    } else { // إذا جئنا من صفحة متابعة الحراس
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { data } = await supabaseClient.from('attendance').select('*').eq('guard_id', guardId).gte('created_at', todayStart.toISOString()).order('created_at', {ascending: false}).limit(1).single();
        record = data;
    }

    if (record) { // إذا وجدنا سجل لليوم، نعبئ البيانات
        document.getElementById('edit-attendance-id').value = record.id;
        document.getElementById('edit-attendance-status').value = record.status;
        document.getElementById('edit-checkin-time').value = toLocalISOString(record.created_at);
        document.getElementById('edit-checkout-time').value = toLocalISOString(record.checkout_at);
    } else { // إذا لم نجد سجل (حالة غياب)، نجهز لإنشاء سجل جديد
        document.getElementById('edit-attendance-id').value = ''; // فارغ للإشارة إلى أنه سجل جديد
        document.getElementById('edit-checkin-time').dataset.guardId = guardId; // نخزن هوية الحارس هنا
        document.getElementById('edit-checkin-time').dataset.guardName = guardName;
    }
    
    modal.classList.remove('hidden');
}

// حفظ التعديلات (للإنشاء والتحديث)
const saveAttendanceBtn = event.target.closest('#save-attendance-changes-btn');
if (saveAttendanceBtn) {
    const attendanceId = document.getElementById('edit-attendance-id').value;
    const checkinInput = document.getElementById('edit-checkin-time');
    
    const updateData = {
        status: document.getElementById('edit-attendance-status').value,
        created_at: checkinInput.value ? new Date(checkinInput.value) : null,
        checkout_at: document.getElementById('edit-checkout-time').value ? new Date(document.getElementById('edit-checkout-time').value) : null
    };

    saveAttendanceBtn.disabled = true;
    let error;

    if (attendanceId) {
        // --- وضع التحديث ---
        ({ error } = await supabaseClient.from('attendance').update(updateData).eq('id', attendanceId));
    } else {
        // --- وضع الإنشاء (للغائب) ---
        updateData.guard_id = checkinInput.dataset.guardId;
        updateData.guard_name = checkinInput.dataset.guardName;
        ({ error } = await supabaseClient.from('attendance').insert(updateData));
    }

    if (error) {
        showToast('فشل تحديث السجل.', 'error');
        console.error("Attendance edit error:", error);
    } else {
        showToast('تم تحديث السجل بنجاح.', 'success');
        document.getElementById('admin-edit-attendance-modal').classList.add('hidden');
        await supabaseClient.from('audit_logs').insert({
            user_name: currentUser.name, action_type: 'تعديل سجل حضور يدوي',
            details: { modified_record_id: attendanceId || 'new', new_status: updateData.status }
        });
        
        // تحديث الواجهة التي نحن فيها
        if (document.querySelector('#page-hr-attendance-log:not(.hidden)')) loadHrAttendanceLogPage();
        if (document.querySelector('#page-guard-attendance:not(.hidden)')) loadGuardAttendancePage();
    }
    saveAttendanceBtn.disabled = false;
}

// --- منطق زر إعادة تعيين كلمة المرور ---
const resetPasswordBtn = event.target.closest('.admin-reset-password-btn');
if (resetPasswordBtn) {
    const authUserId = resetPasswordBtn.dataset.authId;
    const newPassword = prompt("الرجاء إدخال كلمة المرور الجديدة للمستخدم (6 أحرف على الأقل):");

    if (newPassword && newPassword.length >= 6) {
        if (confirm(`هل أنت متأكد من تغيير كلمة المرور؟`)) {
            resetPasswordBtn.disabled = true;

            const { data, error } = await supabaseClient.functions.invoke('update-employee-password', {
                body: { auth_id: authUserId, new_password: newPassword }
            });

            if (error || data.error) {
                showToast(error?.message || data.error, 'error');
            } else {
                showToast('تم تحديث كلمة المرور بنجاح!', 'success');
            }

            resetPasswordBtn.disabled = false;
        }
    } else if (newPassword) {
        alert('كلمة المرور قصيرة جدًا.');
    }
}


// --- منطق زر تسجيل الدخول كمستخدم آخر ---
const loginAsBtn = event.target.closest('.admin-login-as-btn');
if (loginAsBtn) {
    const targetUserId = loginAsBtn.dataset.userId;
    const targetUserName = loginAsBtn.dataset.userName;
    if (confirm(`هل أنت متأكد من رغبتك في تسجيل الدخول بحساب "${targetUserName}"؟`)) {
        try {
            // 1. حفظ جلسة المدير الحالية
            const { data: { session } } = await supabaseClient.auth.getSession();
            localStorage.setItem('admin_session', JSON.stringify(session));

            // 2. استدعاء الوظيفة الخلفية للحصول على توكن مؤقت
            const { data, error } = await supabaseClient.functions.invoke('admin-impersonate', {
                body: { target_user_id: targetUserId }
            });

            if (error || data.error) throw new Error(error?.message || data.error);

            // 3. استخدام التوكن المؤقت لتسجيل الدخول
            await supabaseClient.auth.setSession({
                access_token: data.access_token,
                refresh_token: session.refresh_token // يمكن استخدام نفس الرفرش توكن
            });

            // 4. إعادة تحميل الصفحة
            location.reload();
        } catch (err) {
            alert(`فشل تسجيل الدخول: ${err.message}`);
        }
    }
}

// --- منطق زر العودة لحساب المدير ---
const returnToAdminBtn = event.target.closest('#return-to-admin-btn');
if (returnToAdminBtn) {
    const adminSessionString = localStorage.getItem('admin_session');
    if (adminSessionString) {
        const adminSession = JSON.parse(adminSessionString);
        // استعادة جلسة المدير
        await supabaseClient.auth.setSession(adminSession);
        // حذف الجلسة المحفوظة
        localStorage.removeItem('admin_session');
        // إعادة تحميل الصفحة
        location.reload();
    }
}


// --- منطق أزرار صفحة إدارة المستخدمين ---

// زر "إضافة مستخدم جديد"
const adminAddUserBtn = event.target.closest('#admin-add-user-btn');
if (adminAddUserBtn) {
    // سنستخدم نفس نافذة الموظفين ولكن مع تفعيل زر "إضافة موظف"
    document.getElementById('add-employee-btn').click();
}

// زر "تعديل مستخدم"
const adminEditUserBtn = event.target.closest('.admin-edit-user-btn');
    if (adminEditUserBtn) {
        // هذا الزر سيقوم بمحاكاة الضغط على زر التعديل الموجود في صفحة الموارد البشرية
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-employee-btn';
        editBtn.dataset.id = adminEditUserBtn.dataset.id;
        document.body.appendChild(editBtn); // إضافة الزر المؤقت للصفحة
        editBtn.click(); // الضغط عليه لتفعيل الأمر
        document.body.removeChild(editBtn); // حذف الزر المؤقت
    }

// زر "حذف مستخدم"
const adminDeleteUserBtn = event.target.closest('.admin-delete-user-btn');
    if (adminDeleteUserBtn) {
        // هذا الزر سيقوم بمحاكاة الضغط على زر الحذف الموجود في صفحة الموارد البشرية
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-employee-btn';
        deleteBtn.dataset.id = adminDeleteUserBtn.dataset.id;
        deleteBtn.dataset.authId = adminDeleteUserBtn.dataset.authId;
        document.body.appendChild(deleteBtn); // إضافة الزر المؤقت للصفحة
        deleteBtn.click(); // الضغط عليه لتفعيل الأمر
        document.body.removeChild(deleteBtn); // حذف الزر المؤقت
    }

// --- منطق فتح وإغلاق قائمة الإشعارات ---
const bellBtn = event.target.closest('#notification-bell-btn');
const notificationDropdown = document.getElementById('notification-dropdown');

if (bellBtn) {
    const isHidden = notificationDropdown.classList.contains('hidden');
    if (isHidden) {
        // فتح القائمة وتحميل الإشعارات
        notificationDropdown.classList.remove('hidden');
        const content = document.getElementById('notification-list-content');
        content.innerHTML = '<p style="padding: 15px; text-align: center;">جاري التحميل...</p>';
        
        const { data, error } = await supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_id', currentUser.auth_user_id)
            .order('created_at', { ascending: false })
            .limit(10);
            
        if (error || data.length === 0) {
            content.innerHTML = '<p style="padding: 15px; text-align: center;">لا توجد إشعارات.</p>';
        } else {
            content.innerHTML = data.map(n => `
                <div class="notification-item" data-id="${n.id}">
                    <p>${n.title}</p>
                    <small>${new Date(n.created_at).toLocaleString('ar-SA')}</small>
                </div>
            `).join('');
        }
        
        // بعد عرض الإشعارات، قم بتحديثها إلى "مقروءة" وإخفاء النقطة الحمراء
        document.getElementById('notification-count-badge').classList.add('hidden');
        await supabaseClient.from('notifications').update({ is_read: true }).eq('user_id', currentUser.auth_user_id);

    } else {
        notificationDropdown.classList.add('hidden');
    }
} else if (!event.target.closest('#notification-bell-container')) {
    // إغلاق القائمة عند الضغط في أي مكان آخر في الصفحة
    notificationDropdown.classList.add('hidden');
}


// --- منطق فتح نافذة الشكاوى والاقتراحات ---
if (event.target.closest('#open-feedback-modal-btn')) {
    document.getElementById('feedback-modal').classList.remove('hidden');
}



// --- منطق إغلاق نافذة التنبيهات المخصصة ---
if (event.target.closest('#custom-alert-close-btn')) {
    document.getElementById('custom-alert-modal').classList.add('hidden');
}
// بداية الإضافة

// --- عند الضغط على "تصدير المستحقات" ---
const exportPendingBtn = event.target.closest('#export-pending-payments-btn');
if (exportPendingBtn) {
    if (pendingPaymentsData && pendingPaymentsData.length > 0) {
        // تجهيز البيانات بشكل مناسب للتصدير
        const formattedData = pendingPaymentsData.map(p => ({
            "تاريخ الوردية": new Date(p.shift_date).toLocaleDateString('ar-SA'),
            "اسم المستلم": p.covering_guard_name,
            "الحارس الغائب": p.absent_guard_name || 'N/A',
            "المشروع": p.coverage_shifts?.project || 'غير محدد',
            "الموقع": p.coverage_shifts?.location || 'غير محدد',
            "مبلغ المستحق": p.payment_amount,
            "الآيبان": p.applicant_iban,
            "البنك": p.applicant_bank_name || '-'
        }));
        const filename = `مستحقات-بانتظار-الدفع-${new Date().toISOString().split('T')[0]}.xlsx`;
        exportPayrollToExcel(formattedData, filename); // استخدام نفس دالة التصدير
    } else {
        alert('لا توجد بيانات لتصديرها.');
    }
}

// نهاية الإضافة        



// بداية الإضافة

// --- عند الضغط على "تصدير تقرير الغياب" ---
const exportAbsenteeBtn = event.target.closest('#export-absentee-report-btn');
if (exportAbsenteeBtn) {
    if (absenteeReportData && absenteeReportData.length > 0) {
        const filename = `تقرير-خصم-الغياب-${new Date().toISOString().split('T')[0]}.xlsx`;
        exportPayrollToExcel(absenteeReportData, filename);
    } else {
        alert('لا توجد بيانات لتصديرها.');
    }
}

// نهاية الإضافة


// --- عند الضغط على "اعتماد التغطية" ---
    const approveCoverageBtn = event.target.closest('.approve-coverage-completion-btn');
    if (approveCoverageBtn) {
        const shiftId = approveCoverageBtn.dataset.shiftId;
        const applicantId = approveCoverageBtn.dataset.applicantId;

        if (!confirm('هل أنت متأكد من اعتماد إتمام هذه التغطية؟ سيتم إرسالها للمالية.')) return;
        
        try {
            const { data: applicant, error: e1 } = await supabaseClient.from('coverage_applicants').select('*, coverage_shifts(*)').eq('id', applicantId).single();
            if (e1 || !applicant) throw new Error('لم يتم العثور على بيانات المتقدم.');

            if (applicant.applicant_user_id) { // إذا كان الموظف رسمي
                // تسجيلها كعمل إضافي
                await supabaseClient.from('overtime_records').insert({
                    employee_id: applicant.applicant_user_id,
                    coverage_shift_id: shiftId,
                    overtime_pay: applicant.coverage_shifts.coverage_pay,
                    approved_by: currentUser.id
                });
            } else { // إذا كان متقدم خارجي
                // إرسالها لجدول المالية
                await supabaseClient.from('coverage_payments').insert({
                    coverage_shift_id: shiftId,
                    applicant_id: applicantId,
                    covering_guard_name: applicant.full_name,
                    payment_amount: applicant.coverage_shifts.coverage_pay,
                    applicant_iban: applicant.iban,
                    applicant_bank_name: 'N/A', // يمكن إضافته لاحقاً
                    shift_date: new Date(applicant.coverage_shifts.created_at).toISOString().split('T')[0],
                    notes: `تغطية لـ: ${applicant.coverage_shifts.reason}`
                });
            }

            // إغلاق الوردية نهائياً
            await supabaseClient.from('coverage_shifts').update({ status: 'completed' }).eq('id', shiftId);
            alert('تم اعتماد التغطية بنجاح.');
            loadCoveragePage();

        } catch (error) {
            alert('حدث خطأ: ' + error.message);
        }
    }

    // --- عند الضغط على "استبعاد" ---
    const rejectCoverageBtn = event.target.closest('.reject-coverage-assignment-btn');
    if (rejectCoverageBtn) {
        const shiftId = rejectCoverageBtn.dataset.shiftId;
        const applicantId = rejectCoverageBtn.dataset.applicantId;

        const reason = prompt('الرجاء كتابة سبب الاستبعاد:');
        if (!reason) return;

        try {
            // إعادة فتح الوردية للتقديم من جديد
            await supabaseClient.from('coverage_shifts').update({ status: 'open' }).eq('id', shiftId);
            // رفض المتقدم الحالي
            await supabaseClient.from('coverage_applicants').update({ status: 'rejected', rejection_reason: `تم الاستبعاد بواسطة العمليات: ${reason}` }).eq('id', applicantId);

            alert('تم استبعاد الموظف وإعادة فتح التغطية.');
            loadCoveragePage();

        } catch (error) {
            alert('حدث خطأ: ' + error.message);
        }
    }


// --- منطق تبويبات صفحة المالية ---
    const financeTab = event.target.closest('#page-finance-coverage .tab-link');
    if (financeTab) {
        event.preventDefault();
        const targetTabId = financeTab.dataset.tab;
        financeTab.parentElement.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('#page-finance-coverage .tab-content').forEach(c => c.classList.remove('active'));
        financeTab.classList.add('active');
        document.getElementById(targetTabId).classList.add('active');
        
        if (targetTabId === 'finance-pending-tab') loadPendingPayments();
        if (targetTabId === 'finance-archive-tab') loadPaymentArchive();
    }

    // --- عند الضغط على زر "تم التحويل" ---
    const markAsPaidBtn = event.target.closest('.mark-as-paid-btn');
    if (markAsPaidBtn) {
        const paymentId = markAsPaidBtn.dataset.paymentId;
        const applicantId = markAsPaidBtn.dataset.applicantId;

        if (!confirm('هل أنت متأكد؟ سيتم نقل هذا السجل للأرشيف وحذف حساب الموظف المؤقت.')) return;
        markAsPaidBtn.disabled = true;
        markAsPaidBtn.textContent = 'جاري...';

        try {
            const { data: payment, error: e1 } = await supabaseClient.from('coverage_payments').select('*').eq('id', paymentId).single();
            if (e1 || !payment) throw new Error('لم يتم العثور على سجل الدفعة.');
            
            await supabaseClient.from('payment_archive').insert({
                original_payment_id: payment.id,
                covering_guard_name: payment.covering_guard_name,
                payment_amount: payment.payment_amount,
                applicant_iban: payment.applicant_iban,
                shift_date: payment.shift_date,
                paid_by_user_id: currentUser.id
            });

            await supabaseClient.from('coverage_payments').delete().eq('id', paymentId);

            if (applicantId && applicantId !== 'null') {
                const { data: applicant } = await supabaseClient.from('coverage_applicants').select('applicant_user_id').eq('id', applicantId).single();
                if (applicant && applicant.applicant_user_id) {
                    await supabaseClient.functions.invoke('delete-employee-by-id', { body: { user_id: applicant.applicant_user_id } });
                }
            }

            alert('تم تسجيل العملية بنجاح.');
            loadPendingPayments();

        } catch (error) {
            alert('حدث خطأ: ' + error.message);
        } finally {
            markAsPaidBtn.disabled = false;
            markAsPaidBtn.textContent = 'تم التحويل';
        }
    }

    // --- عند الضغط على "توليد مسير الحراس الغائبين" ---
    const generateAbsenteeBtn = event.target.closest('#generate-absentee-report-btn');
    if (generateAbsenteeBtn) {
        generateAbsenteeReport(); // استدعاء الدالة الجديدة
    }
    
// --- عند الضغط على "عرض تفاصيل" متقدم للتغطية ---
    const viewCoverageApplicantBtn = event.target.closest('.view-coverage-applicant-btn');
    if (viewCoverageApplicantBtn) {
        const applicationId = viewCoverageApplicantBtn.dataset.appid;
        const modal = document.getElementById('applicant-details-modal');
        const body = document.getElementById('applicant-details-body');
        
        modal.classList.remove('hidden');
        body.innerHTML = '<p style="text-align: center;">جاري تحميل البيانات...</p>';

        try {
            const { data: application, error } = await supabaseClient
                .from('coverage_applicants')
                .select('*')
                .eq('id', applicationId)
                .single();
            if (error || !application) throw new Error('خطأ في جلب بيانات المتقدم.');

            let idPhotoUrl = "https://placehold.co/400x250/e2e8f0/a0aec0?text=لا+يوجد+مرفق";
            let ibanCertUrl = "https://placehold.co/400x250/e2e8f0/a0aec0?text=لا+يوجد+مرفق";

            if (application.id_photo_url && application.iban_certificate_url) {
                const { data: signedUrls, error: urlError } = await supabaseClient
                    .storage.from('job-applications').createSignedUrls([application.id_photo_url, application.iban_certificate_url], 300);
                if (!urlError) {
                    idPhotoUrl = signedUrls.find(u => u.path === application.id_photo_url)?.signedUrl || idPhotoUrl;
                    ibanCertUrl = signedUrls.find(u => u.path === application.iban_certificate_url)?.signedUrl || ibanCertUrl;
                }
            }
            
            body.innerHTML = `
                <div class="contract-display">
                    <h4>بيانات المتقدم</h4>
                    <p><strong>الاسم:</strong> ${application.full_name || ''}</p>
                    <p><strong>رقم الهوية:</strong> ${application.id_number || ''}</p>
                    <p><strong>رقم الجوال:</strong> ${application.phone_number || ''}</p>
                    <p><strong>الآيبان:</strong> ${application.iban || ''}</p>
                    <hr>
                    <h4>المرفقات (اضغط على الصورة للتكبير)</h4>
                    <div class="attachments-grid">
                        <div>
                            <h5>صورة الهوية</h5>
                            <img src="${idPhotoUrl}" alt="صورة الهوية" class="attachment-image viewable-image">
                        </div>
                        <div>
                            <h5>شهادة الآيبان</h5>
                            <img src="${ibanCertUrl}" alt="شهادة الآيبان" class="attachment-image viewable-image">
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            body.innerHTML = `<p style="color:red;">${error.message}</p>`;
        }
    }

// --- عند الضغط على "بدء عملية التعيين" ---
    const startAssignmentBtn = event.target.closest('#start-assignment-btn');
    if (startAssignmentBtn) {
        const selectedShiftItem = document.querySelector('.coverage-shift-item[style*="border-color: var(--accent-color)"]');
        if (!selectedShiftItem) return alert('الرجاء تحديد فرصة تغطية أولاً.');

        const shiftData = JSON.parse(selectedShiftItem.dataset.shiftId);
        document.getElementById('assignment-modal').classList.remove('hidden');
        populateAssignmentModal(shiftData);
    }

// --- عند الضغط على زر "تسجيل حضور" (مع التحقق من النطاق الجغرافي) ---
// بداية الاستبدال

// ==========================================================
// ===   بداية الاستبدال الكامل لمنطق زر تسجيل الحضور   ===
// ==========================================================
if (event.target.closest('#check-in-btn')) {
    const checkInBtn = event.target.closest('#check-in-btn');
    checkInBtn.disabled = true;
    checkInBtn.innerHTML = '<i class="ph-fill ph-spinner-gap animate-spin"></i> التحقق...';

    const handleLocationError = (geoError) => {
        console.error('Geolocation Error:', geoError);
        let title = 'خطأ في تحديد الموقع';
        let message = 'فشل النظام في الوصول لموقعك. يرجى التأكد من تفعيل خدمات الموقع والمحاولة مرة أخرى.';
        showCustomAlert(title, message, 'error');
        checkInBtn.disabled = false;
        checkInBtn.innerHTML = 'تسجيل حضور';
    };

    try {
        if (!currentUser.vacancy_id) throw new Error('أنت غير معين على شاغر وظيفي حالياً.');
        
        // --- بداية التعديل 1: جلب كل البيانات المطلوبة من الشاغر ---
        const { data: vacancy, error: e1 } = await supabaseClient
            .from('job_vacancies')
            .select('contract_id, project, location, region, specific_location, schedule_details')
            .eq('id', currentUser.vacancy_id)
            .single();
        // --- نهاية التعديل 1 ---

        if (e1 || !vacancy) throw new Error('لم يتم العثور على بيانات الشاغر الوظيفي الخاص بك.');
        
        const contractId = vacancy.contract_id;
        if (!contractId) throw new Error('الشاغر الوظيفي غير مرتبط بعقد.');

        if (!vacancy.schedule_details?.[0]) throw new Error('لم يتم العثور على جدول ورديات لك.');
        const shift = vacancy.schedule_details[0];

        const { data: contract, error: e2 } = await supabaseClient.from('contracts').select('contract_locations').eq('id', contractId).single();
        if (e2 || !contract) throw new Error('لا يمكن العثور على بيانات العقد المرتبط بك.');

        const locationData = contract.contract_locations.find(loc => loc.name === vacancy.specific_location);
        if (!locationData || !locationData.geofence_link) throw new Error('لم يتم تحديد إحداثيات الموقع في العقد.');
        
        const siteCoords = parseCoordinates(locationData.geofence_link);
        if (!siteCoords) throw new Error('إحداثيات موقع العمل في العقد غير صالحة.');
        const radius = locationData.geofence_radius || 200;

        checkInBtn.innerHTML = '<i class="ph-fill ph-spinner-gap animate-spin"></i> تحديد موقعك...';
        
        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const guardCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
                const distance = calculateDistance(siteCoords, guardCoords);
                if (distance > radius) throw new Error(`أنت خارج نطاق العمل. المسافة الحالية: ${Math.round(distance)} متر.`);
                
                // --- بداية التعديل 2: إضافة كل الحقول المطلوبة عند الحفظ ---
                const { error: insertError } = await supabaseClient.from('attendance').insert({
                    guard_id: currentUser.id,
                    guard_name: currentUser.name,
                    vacancy_id: currentUser.vacancy_id,
                    project: vacancy.project,
                    location: vacancy.specific_location,
                    region: vacancy.region,
                    city: vacancy.location,
                    checkin_lat: guardCoords.lat,
                    checkin_lon: guardCoords.lng,
                    status: 'حاضر'
                });
                // --- نهاية التعديل 2 ---

                if (insertError) {
                    console.error('Detailed Supabase Insert Error:', insertError);
                    throw new Error('حدث خطأ أثناء محاولة تسجيل حضورك في قاعدة البيانات.');
                }
                
                showCustomAlert('نجاح', 'تم تسجيل حضورك بنجاح.', 'success');
                loadAttendancePage();
            } catch (innerError) {
                showCustomAlert('خطأ', innerError.message, 'error');
                checkInBtn.disabled = false;
                checkInBtn.innerHTML = 'تسجيل حضور';
            }
        }, handleLocationError, { 
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0
        });

    } catch (error) {
        showCustomAlert('خطأ في الإعدادات', error.message, 'error');
        checkInBtn.disabled = false;
        checkInBtn.innerHTML = 'تسجيل حضور';
    }
}

// نهاية الاستبدال


// --- منطق أزرار تعيين التغطية لمدير العمليات ---
    const assignCoverageBtn = event.target.closest('.assign-coverage-btn');
    if (assignCoverageBtn) {
        const type = assignCoverageBtn.dataset.type;
        const shiftId = assignCoverageBtn.dataset.shiftId;

        assignCoverageBtn.disabled = true;

        try {
            if (type === 'external') {
                const applicantId = assignCoverageBtn.dataset.applicantId;
                if (!confirm('هل أنت متأكد؟ سيتم رفع طلب هذا المرشح للموارد البشرية.')) return;

                await supabaseClient.from('coverage_applicants').update({ status: 'pending_hr' }).eq('id', applicantId);
                await supabaseClient.from('coverage_shifts').update({ status: 'closed' }).eq('id', shiftId);
                alert('تم رفع الطلب بنجاح.');

            } else if (type === 'overtime' || type === 'direct') {
                const employeeId = assignCoverageBtn.dataset.employeeId;
                const overtimePay = parseFloat(assignCoverageBtn.dataset.pay);
                if (!confirm(`هل أنت متأكد من تعيين هذا الموظف؟ سيتم تسجيل ${overtimePay} ر.س كعمل إضافي له.`)) return;
                
                // تسجيلها في جدول العمل الإضافي
                await supabaseClient.from('overtime_records').insert({
                    employee_id: employeeId,
                    coverage_shift_id: shiftId,
                    overtime_pay: overtimePay,
                    approved_by: currentUser.id
                });
                
                // إغلاق الوردية
                await supabaseClient.from('coverage_shifts').update({ status: 'closed' }).eq('id', shiftId);
                
                // رفض باقي المتقدمين (إن وجدوا)
                await supabaseClient.from('coverage_applicants').update({ status: 'rejected', rejection_reason: 'تم اختيار موظف آخر للتغطية' }).eq('shift_id', shiftId);

                alert('تم تعيين الموظف للتغطية بنجاح.');
            }

            // تحديث الواجهة
            loadCoveragePage();
            document.getElementById('coverage-details-panel').innerHTML = '<p style="text-align: center; padding: 40px;">تمت معالجة الطلب بنجاح.</p>';

        } catch (error) {
            alert('حدث خطأ: ' + error.message);
        } finally {
            assignCoverageBtn.disabled = false;
        }
    }


// --- عند الضغط على فرصة تغطية لعرض تفاصيلها ---
    const coverageItem = event.target.closest('.coverage-shift-item');
    if (coverageItem) {
        // إزالة التحديد من جميع العناصر وإضافته للعنصر المحدد
        document.querySelectorAll('.coverage-shift-item').forEach(item => item.style.borderColor = 'var(--border-color)');
        coverageItem.style.borderColor = 'var(--accent-color)';
        
        const shiftData = JSON.parse(coverageItem.dataset.shiftId);
        displayCoverageDetails(shiftData);
    }


// --- منطق أزرار مراجعة طلبات التغطية لمدير العمليات ---
    // --- منطق أزرار مراجعة طلبات التغطية لمدير العمليات (النسخة الجديدة مع الاعتماد النهائي) ---
// --- منطق أزرار مراجعة طلبات التغطية لمدير العمليات ---
const opsCoverageBtn = event.target.closest('.ops-coverage-action-btn');
if (opsCoverageBtn) {
    const applicantId = opsCoverageBtn.dataset.applicantId;
    const shiftId = opsCoverageBtn.dataset.shiftId;
    const action = opsCoverageBtn.dataset.action;

    opsCoverageBtn.disabled = true;

    try {
        if (action === 'approve_employee') {
            if (!confirm('هل أنت متأكد؟ سيتم تعيين هذا الموظف للتغطية كعمل إضافي.')) { opsCoverageBtn.disabled = false; return; }
            
            const { data: shift, error: e1 } = await supabaseClient.from('coverage_shifts').select('coverage_pay').eq('id', shiftId).single();
            const { data: applicant, error: e2 } = await supabaseClient.from('coverage_applicants').select('applicant_user_id').eq('id', applicantId).single();
            if (e1 || e2) throw new Error('فشل جلب البيانات.');

            await supabaseClient.from('overtime_records').insert({
                employee_id: applicant.applicant_user_id,
                coverage_shift_id: shiftId,
                overtime_pay: shift.coverage_pay,
                approved_by: currentUser.id
            });
            
            await supabaseClient.from('coverage_applicants').update({ status: 'ops_final_approved' }).eq('id', applicantId);
            await supabaseClient.from('coverage_shifts').update({ status: 'closed' }).eq('id', shiftId);
            showToast('تم تعيين الموظف للتغطية بنجاح.', 'success');

        } else if (action === 'approve_external') {
            if (!confirm('هل أنت متأكد؟ سيتم إنشاء حساب مؤقت للمتقدم وإغلاق هذه التغطية.')) { opsCoverageBtn.disabled = false; return; }
            
            // --- هنا التصحيح: تم إضافة shift_id للبيانات المرسلة ---
            const { data, error } = await supabaseClient.functions.invoke('assign-coverage-guard', {
                body: { 
                    applicant_id: applicantId,
                    shift_id: shiftId 
                }
            });
        
            if (error || data.error) {
                throw new Error(error?.message || data.error);
            }
            
            await supabaseClient.from('coverage_shifts').update({ status: 'closed' }).eq('id', shiftId);

            showToast('تم اعتماد المتقدم وتسكينه بنجاح. تم إغلاق التغطية.', 'success');

        } else if (action === 'reject') {
            const reason = prompt('الرجاء كتابة سبب الرفض:');
            if (reason) {
                await supabaseClient.from('coverage_applicants').update({ status: 'rejected', rejection_reason: reason }).eq('id', applicantId);
                showToast('تم رفض الطلب.', 'success');
            }
        }
        
        loadCoverageRequestsPage(); // إعادة تحميل الصفحة

    } catch (error) {
        showToast(`حدث خطأ: ${error.message}`, 'error');
    } finally {
        opsCoverageBtn.disabled = false;
    }
}


// --- عند الضغط على زر "ترشيح" متقدم للتغطية ---
    const nominateCoverageBtn = event.target.closest('.nominate-coverage-applicant-btn');
    if (nominateCoverageBtn) {
        const applicationId = nominateCoverageBtn.dataset.appid;
        const shiftId = nominateCoverageBtn.dataset.shiftid;

        if (!confirm('هل أنت متأكد من ترشيح هذا المتقدم؟ سيتم إرسال طلبه لمدير العمليات وإخفاء باقي المتقدمين.')) return;

        nominateCoverageBtn.disabled = true;
        nominateCoverageBtn.textContent = 'جاري...';

        try {
            // 1. تحديث حالة المتقدم المرشح إلى "بانتظار موافقة العمليات"
            const { error: e1 } = await supabaseClient.from('coverage_applicants')
                .update({ status: 'pending_ops', supervisor_approver_id: currentUser.id })
                .eq('id', applicationId);
            if (e1) throw e1;
            
            // 2. تحديث حالة باقي المتقدمين لنفس الوردية إلى "لم يتم الترشيح"
            const { error: e2 } = await supabaseClient.from('coverage_applicants')
                .update({ status: 'not_nominated' })
                .eq('shift_id', shiftId)
                .not('id', 'eq', applicationId);
            if (e2) console.warn("Could not update other applicants:", e2);

            alert('تم ترشيح المتقدم بنجاح!');
            loadSupervisorCoverageAppsPage(); // إعادة تحميل الصفحة

        } catch (error) {
            alert('حدث خطأ أثناء عملية الترشيح: ' + error.message);
        } finally {
            nominateCoverageBtn.disabled = false;
            nominateCoverageBtn.textContent = 'ترشيح';
        }
    }

// --- عند الضغط على زر "عرض تفاصيل العقد" ---
if (event.target.closest('.view-contract-btn')) {
    const contractId = event.target.closest('.view-contract-btn').dataset.id;
    const modal = document.getElementById('view-contract-modal');
    const body = document.getElementById('contract-view-body');
    const title = document.getElementById('view-contract-title');

    modal.classList.remove('hidden');
    body.innerHTML = '<p style="text-align: center;">جاري تحميل البيانات...</p>';

    const { data: contract, error } = await supabaseClient
        .from('contracts')
        .select('*')
        .eq('id', contractId)
        .single();

    if (error || !contract) {
        body.innerHTML = '<p style="color:red;">حدث خطأ في جلب بيانات العقد.</p>';
        return;
    }

    title.textContent = `تفاصيل عقد: ${contract.company_name}`;

    let detailsHtml = `
        <div class="contract-display">
            <h3>المعلومات الأساسية</h3>
            <p><strong>اسم المشروع:</strong> ${contract.company_name || 'غير محدد'}</p>
            <p><strong>تاريخ نهاية العقد:</strong> ${contract.end_date ? new Date(contract.end_date).toLocaleDateString('ar-SA') : 'غير محدد'}</p>
            <p><strong>المنطقة:</strong> ${contract.region || 'غير محدد'}</p>
            <p><strong>المدينة:</strong> ${(contract.city || []).join('، ') || 'غير محدد'}</p>
            <hr>
            <h3>المواقع والورديات</h3>
        </div>
    `;

    if (contract.contract_locations && contract.contract_locations.length > 0) {
        detailsHtml += contract.contract_locations.map(location => {
            const shiftsHtml = (location.shifts || []).map(shift => {
                const dayMap = {Sun: 'الأحد', Mon: 'الاثنين', Tue: 'الثلاثاء', Wed: 'الأربعاء', Thu: 'الخميس', Fri: 'الجمعة', Sat: 'السبت'};
                const workDays = (shift.days || []).map(d => dayMap[d] || d).join('، ');
                return `
                    <div class="shift-view-item">
                        <p><strong>الوردية:</strong> ${shift.name || 'بدون اسم'}</p>
                        <p><strong>عدد الحراس:</strong> ${shift.guards_count || 0}</p>
                        <p><strong>الوقت:</strong> من ${formatTimeAMPM(shift.start_time)} إلى ${formatTimeAMPM(shift.end_time)}</p>
                        <p><strong>أيام العمل:</strong> ${workDays || 'غير محددة'}</p>
                    </div>`;
            }).join('');

            return `
                <div class="location-view-group">
                    <h4><i class="ph-bold ph-map-pin-line"></i> موقع: ${location.name}</h4>
                    <div class="shifts-view-container">${shiftsHtml || '<p>لا توجد ورديات لهذا الموقع.</p>'}</div>
                </div>`;
        }).join('');
    } else {
        detailsHtml += '<p>لا توجد مواقع محددة في هذا العقد.</p>';
    }

    body.innerHTML = detailsHtml;
}

// --- منطق حساب ساعات العمل تلقائياً ---
document.getElementById('contract-modal')?.addEventListener('change', (event) => {
    const target = event.target;
    // التحقق إذا كان الحقل الذي تم تغييره هو حقل وقت البدء أو الانتهاء
    if (target.classList.contains('shift-start-time') || target.classList.contains('shift-end-time')) {
        const shiftCard = target.closest('.shift-entry-card');
        if (shiftCard) {
            const startTime = shiftCard.querySelector('.shift-start-time').value;
            const endTime = shiftCard.querySelector('.shift-end-time').value;
            const hoursInput = shiftCard.querySelector('.shift-work-hours');

            if (startTime && endTime) {
                const start = new Date(`1970-01-01T${startTime}`);
                const end = new Date(`1970-01-01T${endTime}`);
                let diff = (end - start) / (1000 * 60 * 60);
                if (diff < 0) { // للتعامل مع الورديات الليلية (مثل من 10م إلى 6ص)
                    diff += 24;
                }
                hoursInput.value = diff.toFixed(2); // عرض الساعات مع كسر عشري (مثل 8.5)
            }
        }
    }
});    
// ================================================================
// ===   بداية المنطق الجديد لإدارة العقود (إضافة/تعديل/حفظ)   ===
// ================================================================

// --- منطق إضافة وحذف المواقع والورديات (النسخة المبسطة) ---

// =================================================================
// ===      بداية المنطق الكامل والمصحح لنافذة إدارة العقود      ===
// =================================================================

// --- عند الضغط على زر "تعديل العقد" (مع إصلاح عرض الورديات) ---
// بداية الاستبدال

    // بداية الاستبدال

    if (event.target.closest('.edit-contract-btn')) {
        const contractId = event.target.closest('.edit-contract-btn').dataset.id;
        const { data: contract, error } = await supabaseClient.from('contracts').select('*').eq('id', contractId).single();

        if (error || !contract) { return alert('حدث خطأ في جلب بيانات العقد.'); }

        const modal = document.getElementById('contract-modal');
        
        document.getElementById('contract-modal-title').textContent = 'تعديل العقد';
        document.getElementById('contract-id-hidden').value = contract.id;
        document.getElementById('contract-company-name').value = contract.company_name || '';
        document.getElementById('contract-end-date').value = contract.end_date || '';

        const contractRegion = contract.region || '';
        document.getElementById('contract-region-select').value = contractRegion;
        
        document.getElementById('contract-cities-tags').innerHTML = (contract.city || []).map(city => `<span class="tag-item">${city}<i class="ph-bold ph-x remove-tag"></i></span>`).join('');

        const locationsContainer = document.getElementById('locations-container');
        locationsContainer.innerHTML = '';
        if (contract.contract_locations && Array.isArray(contract.contract_locations)) {
            const contractCities = contract.city || [];

            contract.contract_locations.forEach(locData => {
                const newLocationCard = document.createElement('div');
                newLocationCard.className = 'location-entry-card';

                const regionDisplay = `<input type="text" class="location-region-display" value="${contractRegion}" readonly style="background-color: #e9ecef;">`;
                const cityOptions = contractCities.map(c => `<option value="${c}" ${c === locData.city ? 'selected' : ''}>${c}</option>`).join('');
                
                const shiftsHtml = (locData.shifts || []).map(shiftData => {
                    const daysHtml = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => `<label><input type="checkbox" value="${day}" ${(shiftData.days || []).includes(day) ? 'checked' : ''}> ${day.replace('Sun','الأحد').replace('Mon','الاثنين').replace('Tue','الثلاثاء').replace('Wed','الأربعاء').replace('Thu','الخميس').replace('Fri','الجمعة').replace('Sat','السبت')}</label>`).join('');
                    return `
                        <div class="shift-entry-card">
                            <button class="delete-btn delete-shift-btn" style="position: static; float: left;"><i class="ph-bold ph-x"></i></button>
                            <div class="form-grid" style="grid-template-columns: repeat(4, 1fr);">
                                <div class="form-group"><label>مسمى الوردية</label><input type="text" class="shift-name" value="${shiftData.name || ''}"></div>
                                <div class="form-group"><label>عدد الحراس</label><input type="number" class="shift-guards-count" value="${shiftData.guards_count || 1}"></div>
                                <div class="form-group"><label>من ساعة</label><input type="time" class="shift-start-time" value="${shiftData.start_time || ''}"></div>
                                <div class="form-group"><label>إلى ساعة</label><input type="time" class="shift-end-time" value="${shiftData.end_time || ''}"></div>
                            </div>
                            <div class="form-grid" style="grid-template-columns: 1fr 3fr;">
                                <div class="form-group"><label>ساعات العمل</label><input type="number" class="shift-work-hours" value="${shiftData.work_hours || 0}" readonly style="background-color: #e9ecef;"></div>
                                <div class="form-group"><label>أيام العمل</label><div class="days-selector">${daysHtml}</div></div>
                            </div>
                        </div>
                    `;
                }).join('');

                newLocationCard.innerHTML = `
                    <div class="location-header"><h5>${locData.name}</h5><button class="delete-btn delete-location-card-btn"><i class="ph-bold ph-trash"></i></button></div>
                    <div class="form-grid" style="grid-template-columns: 1fr 1fr; align-items: end;">
                        <div class="form-group"><label>منطقة هذا الموقع</label>${regionDisplay}</div>
                        <div class="form-group"><label>مدينة هذا الموقع</label><select class="location-city-select">${cityOptions}</select></div>
                    </div>
                    <div class="form-grid" style="grid-template-columns: 3fr 1fr; align-items: end; margin-top: 15px;">
                        <div class="form-group">
                            <label>رابط الموقع (إحداثيات)</label>
                            <input type="text" class="location-geofence-link" placeholder="مثال: 24.7111, 46.6800" value="${locData.geofence_link || ''}">
                        </div>
                        <div class="form-group">
                            <label>نطاق التواجد (متر)</label>
                            <input type="number" class="location-geofence-radius" value="${locData.geofence_radius || 200}">
                        </div>
                    </div>
                    <div class="shifts-container-for-location">${shiftsHtml}</div>
                    <button class="btn btn-secondary add-shift-to-card-btn"><i class="ph-bold ph-plus"></i> إضافة وردية</button>
                `;
                locationsContainer.appendChild(newLocationCard);
            });
        }
        
        modal.classList.remove('hidden');
    }

// نهاية الاستبدال

// نهاية الاستبدال

// --- عند الضغط على زر "إضافة موقع" (مع حقول النطاق الجغرافي) ---
if (event.target.closest('#add-location-from-input-btn')) {
    const input = document.getElementById('new-location-name-input');
    const locationName = input.value.trim();
    if (!locationName) return alert('الرجاء كتابة اسم الموقع أولاً.');

    const selectedRegion = document.getElementById('contract-region-select').value;
    const selectedCities = Array.from(document.querySelectorAll('#contract-cities-tags .tag-item')).map(tag => tag.firstChild.textContent);

    if (!selectedRegion || selectedCities.length === 0) {
        return alert('الرجاء اختيار منطقة وإضافة مدينة واحدة على الأقل للعقد قبل إضافة المواقع.');
    }

    const locationsContainer = document.getElementById('locations-container');
    const newLocationCard = document.createElement('div');
    newLocationCard.className = 'location-entry-card';
    
    const cityOptions = selectedCities.map(c => `<option value="${c}">${c}</option>`).join('');

    // بناء الهيكل الكامل لبطاقة الموقع مع إضافة الحقول الجديدة
    newLocationCard.innerHTML = `
        <div class="location-header">
            <h5>${locationName}</h5>
            <button class="delete-btn delete-location-card-btn"><i class="ph-bold ph-trash"></i></button>
        </div>
        <div class="form-grid" style="grid-template-columns: 1fr 1fr; align-items: end;">
            <div class="form-group">
                <label>منطقة هذا الموقع</label>
                <input type="text" class="location-region-display" value="${selectedRegion}" readonly style="background-color: #e9ecef;">
            </div>
            <div class="form-group">
                <label>مدينة هذا الموقع</label>
                <select class="location-city-select">${cityOptions}</select>
            </div>
        </div>
        
        <div class="form-grid" style="grid-template-columns: 3fr 1fr; align-items: end; margin-top: 15px;">
            <div class="form-group">
                <label>رابط الموقع (Google Maps)</label>
                <input type="url" class="location-geofence-link" placeholder="الصق رابط الموقع هنا...">
            </div>
            <div class="form-group">
                <label>نطاق التواجد (متر)</label>
                <input type="number" class="location-geofence-radius" value="200" placeholder="200">
            </div>
        </div>
        <div class="shifts-container-for-location"></div>
        <button class="btn btn-secondary add-shift-to-card-btn"><i class="ph-bold ph-plus"></i> إضافة وردية</button>
    `;

    locationsContainer.appendChild(newLocationCard);
    input.value = '';
}

// --- عند الضغط على زر "حفظ العقد" (النسخة المصححة) ---
// بداية الاستبدال

    // بداية الاستبدال

    if (event.target.closest('#save-contract-btn')) {
        const saveBtn = event.target.closest('#save-contract-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'جاري الحفظ...';

        try {
            const contractId = document.getElementById('contract-id-hidden').value;
            
            const locationsData = Array.from(document.querySelectorAll('#locations-container .location-entry-card')).map(locCard => {
                const shifts = Array.from(locCard.querySelectorAll('.shift-entry-card')).map(shiftCard => {
                    const days = Array.from(shiftCard.querySelectorAll('.days-selector input:checked')).map(input => input.value);
                    return {
                        name: shiftCard.querySelector('.shift-name').value,
                        guards_count: parseInt(shiftCard.querySelector('.shift-guards-count').value) || 0,
                        start_time: shiftCard.querySelector('.shift-start-time').value,
                        end_time: shiftCard.querySelector('.shift-end-time').value,
                        work_hours: parseFloat(shiftCard.querySelector('.shift-work-hours').value) || 0,
                        days: days
                    };
                });
                return {
                    name: locCard.querySelector('h5').textContent,
                    region: locCard.querySelector('.location-region-display').value,
                    city: locCard.querySelector('.location-city-select').value,
                    // بداية الإضافة: قراءة بيانات النطاق عند الحفظ
                    geofence_link: locCard.querySelector('.location-geofence-link').value,
                    geofence_radius: parseInt(locCard.querySelector('.location-geofence-radius').value, 10) || 200,
                    // نهاية الإضافة
                    shifts: shifts
                };
            });

            const contractData = {
                company_name: document.getElementById('contract-company-name').value,
                end_date: document.getElementById('contract-end-date').value || null,
                work_days_policy: document.getElementById('contract-workdays-select').value,
                region: document.getElementById('contract-region-select').value,
                city: Array.from(document.querySelectorAll('#contract-cities-tags .tag-item')).map(tag => tag.firstChild.textContent),
                contract_locations: locationsData,
                status: 'active'
            };

            if (!contractData.company_name || !contractData.region) {
                throw new Error('الرجاء تعبئة اسم العميل واختيار المنطقة.');
            }

            const { error } = contractId
                ? await supabaseClient.from('contracts').update(contractData).eq('id', contractId)
                : await supabaseClient.from('contracts').insert([contractData]);

            if (error) throw error;
            
            showToast('تم حفظ العقد بنجاح!', 'success');
            document.getElementById('contract-modal').classList.add('hidden');
            fetchContracts();

        } catch (error) {
            alert('حدث خطأ: ' + error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'حفظ العقد';
        }
    }

// نهاية الاستبدال

// نهاية الاستبدال

// =================================================================
// ===       نهاية المنطق الكامل والمصحح لنافذة إدارة العقود       ===
// =================================================================

// عند الضغط على زر "حذف الموقع"
if (event.target.closest('.delete-location-card-btn')) {
    if (confirm('هل أنت متأكد من حذف هذا الموقع وكل وردياته؟')) {
        event.target.closest('.location-entry-card').remove();
    }
}

// عند الضغط على زر "إضافة وردية"
if (event.target.closest('.add-shift-to-card-btn')) {
    const shiftsContainer = event.target.previousElementSibling;
    const newShiftEntry = document.createElement('div');
    newShiftEntry.className = 'shift-entry-card';
    newShiftEntry.innerHTML = `
        <button class="delete-btn delete-shift-btn" style="position: static; float: left;"><i class="ph-bold ph-x"></i></button>
        <div class="form-grid" style="grid-template-columns: repeat(4, 1fr);">
            <div class="form-group"><label>مسمى الوردية</label><input type="text" class="shift-name" placeholder="Shift A"></div>
            <div class="form-group"><label>عدد الحراس</label><input type="number" class="shift-guards-count" value="1" min="1"></div>
            <div class="form-group"><label>من ساعة</label><input type="time" class="shift-start-time"></div>
            <div class="form-group"><label>إلى ساعة</label><input type="time" class="shift-end-time"></div>
        </div>
        <div class="form-grid" style="grid-template-columns: 1fr 3fr;">
             <div class="form-group"><label>ساعات العمل</label><input type="number" class="shift-work-hours" value="0" readonly style="background-color: #e9ecef;"></div>
             <div class="form-group"><label>أيام العمل</label><div class="days-selector">
                ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => `<label><input type="checkbox" value="${day}"> ${day.replace('Sun','الأحد').replace('Mon','الاثنين').replace('Tue','الثلاثاء').replace('Wed','الأربعاء').replace('Thu','الخميس').replace('Fri','الجمعة').replace('Sat','السبت')}</label>`).join('')}
            </div></div>
        </div>
    `;
    shiftsContainer.appendChild(newShiftEntry);
}

// عند الضغط على زر "حذف الوردية"
if (event.target.closest('.delete-shift-btn')) {
    event.target.closest('.shift-entry-card').remove();
}


// --- معالجات الأوامر (Click Handlers) الجديدة ---

// ========= بداية المنطق الجديد والمبسط لإدارة العقود =========

// --- عند الضغط على زر "إضافة عقد جديد" ---
if (event.target.closest('#add-contract-btn')) {
        const modal = document.getElementById('contract-modal');
        // إعادة تعيين الفورم
        document.getElementById('contract-modal-title').textContent = 'إضافة عقد جديد';
        document.getElementById('contract-id-hidden').value = '';
        document.getElementById('contract-company-name').value = '';
        document.getElementById('contract-end-date').value = '';
        document.querySelectorAll('#contract-regions-tags .region-tag').forEach(tag => tag.classList.remove('selected'));
        document.getElementById('contract-cities-tags').innerHTML = '';
        document.getElementById('locations-container').innerHTML = '';
        document.getElementById('new-location-name-input').value = '';
        modal.classList.remove('hidden');
    }

// --- عند الضغط على زر "تعديل الموظف" (النسخة النهائية والمبسطة) ---
if (event.target.closest('.edit-employee-btn')) {
    const userId = event.target.closest('.edit-employee-btn').dataset.id;
    if (!userId) return;

    try {
        // 1. جلب بيانات الموظف الأساسية بدون أي ربط مبدئياً
        const { data: employee, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !employee) {
            throw new Error('لم يتم العثور على بيانات الموظف أو حدث خطأ.');
        }

        const modal = document.getElementById('employee-modal');
        
        // 2. تعبئة الحقول العامة التي لا تعتمد على الشاغر
        document.getElementById('employee-modal-title').textContent = 'تعديل بيانات الموظف';
        document.getElementById('employee-id').value = employee.id;
        document.getElementById('employee-auth-id').value = employee.auth_user_id;
        document.getElementById('employee-creation-mode').value = 'update';
        document.getElementById('employee-name').value = employee.name || '';
        document.getElementById('employee-id-number').value = employee.id_number || '';
        document.getElementById('employee-phone').value = employee.phone || '';
        document.getElementById('employee-role').value = employee.role || 'حارس أمن';
        document.getElementById('employee-start-date').value = employee.start_of_work_date;
        document.getElementById('employee-password').value = '';
        document.getElementById('employee-password').placeholder = 'اتركه فارغاً لعدم التغيير';
        document.getElementById('employee-iban').value = employee.iban || '';
        document.getElementById('employee-bank-name').value = employee.bank_name || '';
        document.getElementById('employee-insurance').value = employee.insurance_status || 'غير مسجل';
        document.getElementById('employee-insurance-amount').value = employee.insurance_deduction_amount || 0;
        document.getElementById('employee-status').value = employee.employment_status || 'اساسي';
        document.getElementById('employee-id-number').disabled = true;

        // 3. التعامل مع الحقول المعتمدة على الدور (حارس أمن أو إداري)
        const isSecurityGuard = employee.role === 'حارس أمن';
        const vacancyAndContractFields = [
            document.getElementById('employee-vacancy').parentElement,
            document.getElementById('employee-contract').parentElement,
            document.getElementById('employee-shift-display').parentElement
        ];

        if (isSecurityGuard) {
            // إظهار حقول الشواغر للحراس
            vacancyAndContractFields.forEach(el => el.classList.remove('hidden'));

            const vacancySelect = document.getElementById('employee-vacancy');
            const contractSelect = document.getElementById('employee-contract');
            const shiftDisplay = document.getElementById('employee-shift-display');

            // جلب قوائم الشواغر والعقود
            const { data: openVacanciesData } = await supabaseClient.from('job_vacancies').select('id, project, specific_location').eq('status', 'open');
            const { data: contractsData } = await supabaseClient.from('contracts').select('id, company_name');
            const openVacancies = openVacanciesData || [];
            const contracts = contractsData || [];

            let allRelevantVacancies = [...openVacancies];
            
            // جلب الشاغر الحالي للموظف (إن وجد) وإضافته للقائمة
            if (employee.vacancy_id) {
                const { data: assignedVacancy } = await supabaseClient.from('job_vacancies').select('*').eq('id', employee.vacancy_id).single();
                if (assignedVacancy) {
                    if (!allRelevantVacancies.some(v => v.id === assignedVacancy.id)) {
                        allRelevantVacancies.push(assignedVacancy);
                    }
                    if (assignedVacancy.schedule_details?.[0]) {
                        const shift = assignedVacancy.schedule_details[0];
                        shiftDisplay.value = `${shift.name || 'وردية'} (من ${formatTimeAMPM(shift.start_time)} إلى ${formatTimeAMPM(shift.end_time)})`;
                    }
                }
            } else {
                 shiftDisplay.value = 'لا توجد وردية محددة';
            }
            
            // تعبئة القوائم وتحديد القيم الحالية
            contractSelect.innerHTML = '<option value="">غير تابع لعقد</option>' + contracts.map(c => `<option value="${c.id}">${c.company_name}</option>`).join('');
            vacancySelect.innerHTML = '<option value="">غير مرتبط بشاغر</option>' + allRelevantVacancies.map(v => `<option value="${v.id}">${v.project} - ${v.specific_location || 'موقع عام'}</option>`).join('');
            contractSelect.value = employee.contract_id || '';
            vacancySelect.value = employee.vacancy_id || '';

        } else {
            // إخفاء حقول الشواغر تماماً للموظفين الإداريين
            vacancyAndContractFields.forEach(el => el.classList.add('hidden'));
        }

        // 4. التعامل مع صلاحيات المشرفين ومدراء العمليات
        const assignmentGroup = document.getElementById('manager-assignment-group');
        const regionGroup = document.getElementById('assign-region-group');
        const projectGroup = document.getElementById('assign-project-group');
        assignmentGroup.classList.add('hidden');
        regionGroup.classList.add('hidden');
        projectGroup.classList.add('hidden');

        if (employee.role === 'ادارة العمليات') {
            assignmentGroup.classList.remove('hidden');
            regionGroup.classList.remove('hidden');
            document.getElementById('assign-region-select').value = employee.region || '';
        } else if (employee.role === 'مشرف') {
            assignmentGroup.classList.remove('hidden');
            projectGroup.classList.remove('hidden');
            const projectContainer = document.getElementById('assign-project-checkbox-container');
            const { data: contractsForSupervisorData } = await supabaseClient.from('contracts').select('company_name');
            const contractsForSupervisor = contractsForSupervisorData || [];
            const projectNames = [...new Set(contractsForSupervisor.map(c => c.company_name))];
            const supervisorProjects = Array.isArray(employee.project) ? employee.project : [];
            projectContainer.innerHTML = `<div class="checkbox-grid">${projectNames.map(p => `<label><input type="checkbox" value="${p}" ${supervisorProjects.includes(p) ? 'checked' : ''}> ${p}</label>`).join('')}</div>`;
        }
        
        modal.classList.remove('hidden');

    } catch (err) {
        console.error('Employee fetch error:', err);
        alert('حدث خطأ في جلب بيانات الموظف: ' + err.message);
    }
}






// ========= نهاية المنطق الجديد والمبسط لإدارة العقود =========

// --- أزرار التحكم الديناميكية داخل النافذة ---

// إضافة مدينة
if (event.target.closest('#add-city-btn')) {
    const cityInput = document.getElementById('contract-city-input');
    const cityName = cityInput.value.trim();
    if (cityName) {
        document.getElementById('contract-cities-tags').innerHTML += `<span class="tag-item">${cityName}<i class="ph-bold ph-x remove-tag"></i></span>`;
        cityInput.value = '';
    }
}

// حذف مدينة أو منطقة
if (event.target.classList.contains('remove-tag')) {
    event.target.parentElement.remove();
}
if (event.target.classList.contains('region-tag')) {
    event.target.classList.toggle('selected');
}




// حذف وردية من الموقع المحدد
if (event.target.closest('.delete-shift-btn')) {
    const shiftIndexToDelete = parseInt(event.target.closest('.delete-shift-btn').dataset.shiftIndex, 10);
    if (activeLocationIndex !== -1) {
        contractEditorState.locations[activeLocationIndex].shifts.splice(shiftIndexToDelete, 1);
        renderContractEditor();
    }
}





// ================================================================
// ===                   نهاية المنطق الجديد لإدارة العقود                   ===
// ================================================================    

// --- منطق إضافة عطلة رسمية جديدة ---
    const addHolidayBtn = event.target.closest('#add-holiday-btn');
    if (addHolidayBtn) {
        const holidayDate = document.getElementById('holiday-date').value;
        const description = document.getElementById('holiday-description').value;

        if (!holidayDate || !description) {
            return alert('الرجاء إدخال التاريخ والوصف للعطلة.');
        }

        addHolidayBtn.disabled = true;
        addHolidayBtn.textContent = 'جاري الإضافة...';

        const { error } = await supabaseClient.from('official_holidays').insert({ holiday_date: holidayDate, description: description });
        if (error) {
            alert('حدث خطأ أثناء إضافة العطلة. قد يكون هذا التاريخ مسجلاً من قبل.');
            console.error(error);
        } else {
            alert('تمت إضافة العطلة بنجاح.');
            document.getElementById('holiday-date').value = '';
            document.getElementById('holiday-description').value = '';
            loadHolidaysPage(); // تحديث القائمة
        }

        addHolidayBtn.disabled = false;
        addHolidayBtn.textContent = 'إضافة العطلة';
    }

    // --- منطق حذف عطلة رسمية ---
    const deleteHolidayBtn = event.target.closest('.delete-holiday-btn');
    if (deleteHolidayBtn) {
        const holidayId = deleteHolidayBtn.dataset.id;
        if (confirm('هل أنت متأكد من حذف هذه العطلة الرسمية؟')) {
            const { error } = await supabaseClient.from('official_holidays').delete().eq('id', holidayId);
            if (error) {
                alert('حدث خطأ أثناء الحذف.');
            } else {
                alert('تم حذف العطلة.');
                loadHolidaysPage(); // تحديث القائمة
            }
        }
    }
    
// --- منطق تبويبات صفحة توظيف العمليات ---
const hrOpsTab = event.target.closest('#page-hr-ops-hiring .tab-link');
if (hrOpsTab) {
    if (hrOpsTab.dataset.tab === 'hr-new-reviews') {
        loadHrOpsHiringPage('new');
    } else if (hrOpsTab.dataset.tab === 'hr-archive-reviews') {
        loadHrOpsHiringPage('archive');
    }
}

    // الربط بالتبويبات داخل الصفحة
const archiveTab = event.target.closest('#page-requests-archive .tab-link');
if (archiveTab) {
    event.preventDefault();
    const targetTabId = archiveTab.dataset.tab;
    document.querySelectorAll('#page-requests-archive .tab-link').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#page-requests-archive .tab-content').forEach(c => c.classList.remove('active'));
    archiveTab.classList.add('active');
    document.getElementById(targetTabId).classList.add('active');

    // تحميل بيانات التبويب المطلوب
    if (targetTabId === 'archive-leave-tab') loadArchivePage('leave');
    if (targetTabId === 'archive-loan-tab') loadArchivePage('loan');
    if (targetTabId === 'archive-resignation-tab') loadArchivePage('resignation');
}

// زر البحث في صفحة سجل الحضور (هذا هو المكان الصحيح له)
    if (event.target.id === 'hr-attendance-search-btn') {
        const filters = {
            dateFrom: document.getElementById('hr-attendance-from').value,
            dateTo: document.getElementById('hr-attendance-to').value,
            status: document.getElementById('hr-attendance-status').value,
            project: document.getElementById('hr-attendance-project').value,
            location: document.getElementById('hr-attendance-location').value
        };
        // تعديل تاريخ "إلى" ليشمل اليوم كاملاً
        if (filters.dateTo) {
            let toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59, 999);
            filters.dateTo = toDate.toISOString();
        }
        loadHrAttendanceLogPage(filters);
    }
   

    // --- بداية الإضافة: منطق البحث في الخريطة ---
    const mapSearchBtn = event.target.closest('#map-search-btn');
    if (mapSearchBtn) {
        const searchTerm = document.getElementById('map-search-input').value.toLowerCase();
        if (!searchTerm) return;

        const foundGuard = allGuardsOnMap.find(g => g.name.toLowerCase().includes(searchTerm));
        
        if (foundGuard && guardMarkers.has(foundGuard.id)) {
            const marker = guardMarkers.get(foundGuard.id);
            map.setView(marker.getLatLng(), 16); // تقريب الخريطة على الحارس
            marker.openPopup(); // فتح النافذة المنبثقة
        } else {
            alert('لم يتم العثور على حارس بهذا الاسم.');
        }
    }
    // --- نهاية الإضافة ---

    // --- بداية الإضافة: منطق فتح نافذة الإرسال للجميع ---
const sendToAllBtn = event.target.closest('#send-to-all-guards-btn');
if (sendToAllBtn) {
    const modal = document.getElementById('send-directive-modal');
    document.getElementById('send-directive-modal-title').textContent = 'إرسال توجيه لجميع الحراس';
    // نستخدم "all" كقيمة خاصة لتمييز الإرسال الجماعي
    document.getElementById('directive-recipient-id').value = 'all';
    document.getElementById('directive-content').value = '';
    modal.classList.remove('hidden');
}
// --- نهاية الإضافة ---

// --- منطق فتح نافذة إضافة عقوبة ---
    const addPenaltyBtn = event.target.closest('.add-penalty-btn');
    if (addPenaltyBtn) {
        const modal = document.getElementById('add-penalty-modal');
        const userId = addPenaltyBtn.dataset.userId;
        const userName = addPenaltyBtn.dataset.userName;

        document.getElementById('penalty-modal-title').textContent = `إضافة عقوبة جديدة لـ: ${userName}`;
        document.getElementById('penalty-user-id').value = userId;
        document.getElementById('penalty-reason').value = '';
        document.getElementById('penalty-amount').value = '';
        document.getElementById('penalty-date').valueAsDate = new Date(); // التاريخ الافتراضي هو اليوم
        modal.classList.remove('hidden');
    }

    // --- منطق حفظ العقوبة ---
    const savePenaltyBtn = event.target.closest('#save-penalty-btn');
    if (savePenaltyBtn) {
        const penaltyData = {
            user_id: document.getElementById('penalty-user-id').value,
            reason: document.getElementById('penalty-reason').value,
            amount: parseFloat(document.getElementById('penalty-amount').value) || 0,
            deduction_date: document.getElementById('penalty-date').value
        };

        if (!penaltyData.reason || penaltyData.amount <= 0 || !penaltyData.deduction_date) {
            return alert('الرجاء تعبئة جميع الحقول بشكل صحيح.');
        }

        savePenaltyBtn.disabled = true;
        savePenaltyBtn.textContent = 'جاري الحفظ...';

        const { error } = await supabaseClient.from('penalties').insert(penaltyData);
        if (error) {
            alert('حدث خطأ أثناء حفظ العقوبة: ' + error.message);
        } else {
            alert('تم تسجيل العقوبة بنجاح!');
            document.getElementById('add-penalty-modal').classList.add('hidden');
        }
        
        savePenaltyBtn.disabled = false;
        savePenaltyBtn.textContent = 'حفظ وتطبيق الخصم';
    }

    // --- منطق تغيير كلمة المرور ---
const changePasswordBtn = event.target.closest('#change-password-btn');
if (changePasswordBtn) {
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;

    // التحقق من صحة المدخلات
    if (!newPassword || newPassword.length < 6) {
        return alert('كلمة المرور الجديدة يجب أن لا تقل عن 6 أحرف.');
    }
    if (newPassword !== confirmPassword) {
        return alert('كلمتا المرور غير متطابقتين.');
    }

    changePasswordBtn.disabled = true;
    changePasswordBtn.textContent = 'جاري التحديث...';

    try {
        // استخدام الدالة الرسمية من Supabase لتحديث كلمة مرور المستخدم الحالي
        const { data, error } = await supabaseClient.auth.updateUser({
            password: newPassword
        });

        if (error) throw error;

        alert('تم تحديث كلمة المرور بنجاح!');
        // إفراغ الحقول بعد النجاح
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-new-password').value = '';

    } catch (error) {
        alert(`حدث خطأ أثناء تحديث كلمة المرور: ${error.message}`);
    } finally {
        changePasswordBtn.disabled = false;
        changePasswordBtn.textContent = 'تحديث كلمة المرور';
    }
}

// ========= بداية الاستبدال =========
// --- منطق تفعيل الإشعارات (النسخة الجديدة والمحسنة) ---
const enableNotificationsBtn = event.target.closest('#enable-notifications-btn');
if (enableNotificationsBtn) {
    enableNotificationsBtn.disabled = true;
    setupPushNotifications(enableNotificationsBtn); // استدعاء الدالة الجديدة
}
// ========= نهاية الاستبدال =========


    // --- منطق فتح وإغلاق القائمة الجانبية في الجوال ---
const menuToggleBtn = event.target.closest('#menu-toggle-btn');
if (menuToggleBtn) {
    document.querySelector('.sidebar').classList.toggle('open');
}

// --- منطق فتح نافذة التبديل ---
const swapBtn = event.target.closest('.swap-assignment-btn');
if (swapBtn) {
    const modal = document.getElementById('swap-employee-modal');
    const vacancyId = swapBtn.dataset.vacancyId;
    const currentUserId = swapBtn.dataset.currentUserId;
    const currentUserName = swapBtn.dataset.currentUserName;

    // تعبئة الحقول بالبيانات الحالية
    document.getElementById('swap-vacancy-id').value = vacancyId;
    document.getElementById('swap-current-user-id').value = currentUserId;
    document.getElementById('swap-current-user-name').value = currentUserName;

    // جلب قائمة الموظفين الآخرين
    const employeeSelect = document.getElementById('swap-new-employee-select');
    employeeSelect.innerHTML = '<option value="">جاري تحميل الموظفين...</option>';
    
    // جلب كل الحراس النشطين ما عدا الحارس الحالي
    const { data: employees, error } = await supabaseClient
        .from('users')
        .select('id, name')
        .eq('employment_status', 'نشط')
        .eq('role', 'حارس أمن')
        .not('id', 'eq', currentUserId);

    if (error) {
        employeeSelect.innerHTML = '<option value="">خطأ في التحميل</option>';
    } else {
        employeeSelect.innerHTML = '<option value="">-- اختر موظفاً بديلاً --</option>';
        employeeSelect.innerHTML += employees.map(emp => `<option value="${emp.id}">${emp.name}</option>`).join('');
    }
    
    modal.classList.remove('hidden');
}

// --- منطق حفظ التبديل (النسخة المصححة) ---
const saveSwapBtn = event.target.closest('#save-swap-btn');
if (saveSwapBtn) {
    const vacancy_A_Id = document.getElementById('swap-vacancy-id').value;
    const employee_A_Id = document.getElementById('swap-current-user-id').value;
    const employee_B_Id = document.getElementById('swap-new-employee-select').value;

    if (!employee_B_Id) return alert('الرجاء اختيار الموظف البديل.');

    saveSwapBtn.disabled = true;
    saveSwapBtn.textContent = 'جاري التبديل...';

    try {
        // 1. جلب الشاغر الحالي للموظف الجديد (الموظف ب)
        const { data: employeeB_Data, error: e1 } = await supabaseClient
            .from('users').select('vacancy_id').eq('id', employee_B_Id).single();
        if (e1) throw e1;
        const vacancy_B_Id = employeeB_Data.vacancy_id; // قد يكون null

        // 2. تحديث الموظف القديم (أ) وإعطائه شاغر الموظف الجديد (ب)
        const { error: e2 } = await supabaseClient
            .from('users').update({ vacancy_id: vacancy_B_Id }).eq('id', employee_A_Id);
        if (e2) throw e2;

        // 3. تحديث الموظف الجديد (ب) وتعيينه للشاغر المستهدف (أ)
        const { error: e3 } = await supabaseClient
            .from('users').update({ vacancy_id: vacancy_A_Id }).eq('id', employee_B_Id);
        if (e3) throw e3;

        alert('تم تبديل الموظفين بنجاح.');
        document.getElementById('swap-employee-modal').classList.add('hidden');
        loadVacancyTabData(); // تحديث القائمة

    } catch (error) {
        alert('حدث خطأ أثناء عملية التبديل: ' + error.message);
    } finally {
        saveSwapBtn.disabled = false;
        saveSwapBtn.textContent = 'حفظ التبديل';
    }
}

// بداية الإضافة (أضف هذا الكود داخل معالج الأوامر الكبير)
// --- منطق زر الاعتماد النهائي وتوظيف الموظف (متوافق مع الدالة المحسّنة) ---
const finalApproveBtn = event.target.closest('#final-approve-btn');
if (finalApproveBtn) {
    event.preventDefault();
    const submitBtn = finalApproveBtn;
    
    if (!confirm("هل أنت متأكد من اعتماد هذا المرشح؟ سيتم إنشاء حساب له وربطه بالشاغر.")) {
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="ph-fill ph-spinner-gap animate-spin"></i> جاري التوظيف...';

    const applicationId = document.getElementById('review-app-id').value;
    const vacancyId = document.getElementById('review-vacancy-id').value;

    try {
        const password = document.getElementById('review-password').value;
        const profileData = {
            name: document.getElementById('review-full-name').value,
            id_number: document.getElementById('review-id-number').value,
            phone: document.getElementById('review-phone').value,
            iban: document.getElementById('review-iban').value,
            bank_name: document.getElementById('review-bank-name').value,
            vacancy_id: vacancyId,
            start_of_work_date: new Date().toISOString().split('T')[0],
            employment_status: 'اساسي', // -- هذا هو التعديل الصحيح --
            status: 'active',
            insurance_status: 'غير مسجل'
        };

        const { data: vacancy } = await supabaseClient
            .from('job_vacancies').select('title, project, specific_location, contract_id')
            .eq('id', vacancyId).single();

        // -- بداية التعديل: وضع قيمة المشروع داخل مصفوفة --
        profileData.project = [vacancy.project];
        // -- نهاية التعديل --
        profileData.location = vacancy.specific_location;
        profileData.role = vacancy.title;
        profileData.contract_id = vacancy.contract_id;


        // استدعاء الدالة السحابية والحصول على الاستجابة الكاملة
        console.log('Sending this data to function:', profileData);
        const { data: functionResponse, error: invokeError } = await supabaseClient.functions.invoke('create-employee', { body: { password, ...profileData } });

        if (invokeError) throw new Error(`فشل استدعاء الدالة: ${invokeError.message}`);
        
        // التحقق من وجود خطأ مرسل من داخل الدالة نفسها
        if (functionResponse.error) throw new Error(functionResponse.error);

        const newUserId = functionResponse.data.id;
        if (!newUserId) throw new Error("لم يتم استلام ID الموظف الجديد من السيرفر.");

        // تحديث الطلب والشاغر
        await supabaseClient.from('job_vacancies').update({ status: 'closed' }).eq('id', vacancyId);
        await supabaseClient.from('job_applications').update({ status: 'approved', ops_approver_id: currentUser.id }).eq('id', applicationId);

        alert(`اكتملت العملية بنجاح!`);
        
        document.getElementById('ops-review-applicant-modal').classList.add('hidden');
        loadOpsNomineesPage();
        loadVacancyTabData();
        loadEmployeeTabData();

    } catch(error) {
        alert('حدث خطأ: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="ph-bold ph-user-plus"></i> اعتماد نهائي وتوظيف';
    }
}
 // بداية الاستبدال
// زر عرض تفاصيل الموظف المعين
const viewNewHireBtn = event.target.closest('.view-new-hire-details-btn');
if (viewNewHireBtn) {
    viewNewHireBtn.classList.add('view-applicant-details-btn');
    viewNewHireBtn.click();
    viewNewHireBtn.classList.remove('view-applicant-details-btn');
}

// بداية الاستبدال
const hrAcknowledgeBtn = event.target.closest('.hr-acknowledge-hire-btn');
if (hrAcknowledgeBtn) {
    const applicationId = hrAcknowledgeBtn.dataset.appid;
    if (confirm('هل أنت متأكد من مراجعة هذا التوظيف؟')) {
        const { error } = await supabaseClient.from('job_applications').update({ status: 'hr_acknowledged' }).eq('id', applicationId);
        if (error) { alert('حدث خطأ'); } else { alert('تم تأكيد المراجعة.'); loadHrOpsHiringPage(); }
    }
}
// نهاية الاستبدال
// بداية الكود الجديد
const opsReviewBtn = event.target.closest('.ops-review-applicant-btn');
if (opsReviewBtn) {
    const applicationId = opsReviewBtn.dataset.appid;
    const modal = document.getElementById('ops-review-applicant-modal');
    const formBody = document.getElementById('ops-review-form-body');
    
    modal.classList.remove('hidden');
    formBody.innerHTML = '<p style="text-align: center;">جاري تحميل بيانات المرشح...</p>';

    const { data: application, error } = await supabaseClient
        .from('job_applications')
        .select('*, job_vacancies(*)')
        .eq('id', applicationId)
        .single();
    
    if (error || !application) {
        formBody.innerHTML = '<p style="color:red;">خطأ في جلب البيانات.</p>';
        return;
    }

    document.getElementById('review-app-id').value = application.id;
    document.getElementById('review-vacancy-id').value = application.vacancy_id;

    const appData = application.applicant_data;
    const vacancy = application.job_vacancies;
const shift = vacancy.schedule_details?.[0]; // <-- جلب تفاصيل الوردية

    const signedUrlsToGenerate = [];
    if (application.id_photo_url) signedUrlsToGenerate.push(application.id_photo_url);
    if (application.iban_certificate_url) signedUrlsToGenerate.push(application.iban_certificate_url);

    // --- هنا التعديل: استخدام كود صورة بدلاً من ملف ---
    let idPhotoUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 100'%3E%3Crect width='150' height='100' fill='%23f0f2f5'/%3E%3Ctext x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Cairo, sans-serif' font-size='12' fill='%23a0aec0'%3Eلا يوجد مرفق%3C/text%3E%3C/svg%3E";
    let ibanCertUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 100'%3E%3Crect width='150' height='100' fill='%23f0f2f5'/%3E%3Ctext x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Cairo, sans-serif' font-size='12' fill='%23a0aec0'%3Eلا يوجد مرفق%3C/text%3E%3C/svg%3E";

    if (signedUrlsToGenerate.length > 0) {
        const { data: signedUrls, error: urlError } = await supabaseClient
            .storage.from('job-applications').createSignedUrls(signedUrlsToGenerate, 300);
        if (!urlError) {
            idPhotoUrl = signedUrls.find(u => u.path === application.id_photo_url)?.signedUrl || idPhotoUrl;
            ibanCertUrl = signedUrls.find(u => u.path === application.iban_certificate_url)?.signedUrl || ibanCertUrl;
        }
    }

    formBody.innerHTML = `
        <h4>1. المعلومات الشخصية (قابلة للتعديل)</h4>
        <div class="form-grid">
            <div class="form-group"><label>الاسم الكامل</label><input type="text" id="review-full-name" value="${appData.full_name || ''}"></div>
            <div class="form-group"><label>رقم الهوية</label><input type="text" id="review-id-number" value="${appData.id_number || ''}"></div>
            <div class="form-group"><label>رقم الجوال</label><input type="tel" id="review-phone" value="${appData.phone || ''}"></div>
            <div class="form-group"><label>اسم البنك</label><input type="text" id="review-bank-name" value="${appData.bank_name || ''}"></div>
        </div>
        <div class="form-group" style="margin-top:20px;">
            <label>رقم الآيبان</label><input type="text" id="review-iban" value="${appData.iban || ''}">
        </div>
        <hr>
        <h4>2. المرفقات (اضغط على الصورة للتكبير)</h4>
        <div class="attachments-grid">
            <div>
                <h5>صورة الهوية</h5>
                <img src="${idPhotoUrl}" alt="صورة الهوية" class="attachment-image viewable-image">
            </div>
            <div>
                <h5>شهادة الآيبان</h5>
                <img src="${ibanCertUrl}" alt="شهادة الآيبان" class="attachment-image viewable-image">
            </div>
        </div>
        <hr>
        <h4>3. معلومات التوظيف (للتأكيد)</h4>
        <div class="form-grid">
            <div class="form-group"><label>المسمى الوظيفي</label><input type="text" id="review-title" value="${vacancy.title}" readonly style="background-color: #e9ecef;"></div>
            <div class="form-group"><label>المشروع</label><input type="text" id="review-project" value="${vacancy.project}" readonly style="background-color: #e9ecef;"></div>
            <div class="form-group"><label>الموقع</label><input type="text" id="review-location" value="${vacancy.specific_location}" readonly style="background-color: #e9ecef;"></div>
        </div>
        <div class="form-group" style="margin-top:20px;">
            <label>الوردية المحددة</label>
            <input type="text" value="${shift ? `${shift.name || 'وردية'} (من ${formatTimeAMPM(shift.start_time)} إلى ${formatTimeAMPM(shift.end_time)})` : 'غير محددة'}" readonly style="background-color: #e9ecef; text-align: center; font-weight: bold;">
        </div>
        <hr>
        <h4>4. كلمة المرور</h4>
        <div class="form-group"><label>كلمة مرور مؤقتة</label><input type="text" id="review-password" value="${appData.id_number}"></div>
    `;
}
// نهاية الكود الجديد


    // بداية الإضافة: منطق رفض مدير العمليات للمرشح
const opsRejectBtn = event.target.closest('.ops-reject-applicant-btn');
if (opsRejectBtn) {
    const applicationId = opsRejectBtn.dataset.appid;
    const vacancyId = opsRejectBtn.dataset.vid;

    const reason = prompt("الرجاء إدخال سبب الرفض (سيظهر للمشرف):");
    if (!reason) return;

    if (confirm('هل أنت متأكد من رفض هذا المرشح؟ سيتم إعادة فتح باب الترشيح للمشرف.')) {
        try {
            // 1. تحديث حالة الطلب المرفوض
            await supabaseClient.from('job_applications').update({ status: 'rejected', rejection_reason: reason }).eq('id', applicationId);
            
            // 2. إعادة فتح باب الترشيح لباقي المتقدمين لنفس الشاغر
            await supabaseClient.from('job_applications').update({ status: 'pending_supervisor' }).eq('vacancy_id', vacancyId).eq('status', 'not_nominated');
            
            alert('تم رفض المرشح وإعادة الطلب للمشرف.');
            loadOpsNomineesPage(); // تحديث القائمة

        } catch (error) {
            alert('حدث خطأ: ' + error.message);
        }
    }
}
// نهاية الإضافة

// بداية الإضافة: منطق أزرار مراجعة طلبات التوظيف للمشرف

// بداية الكود الجديد
const viewApplicantBtn = event.target.closest('.view-applicant-details-btn');
if (viewApplicantBtn) {
    const applicationId = viewApplicantBtn.dataset.appid;
    const modal = document.getElementById('applicant-details-modal');
    const body = document.getElementById('applicant-details-body');
    
    modal.classList.remove('hidden');
    body.innerHTML = '<p style="text-align: center;">جاري تحميل البيانات...</p>';

    try {
        const { data: application, error } = await supabaseClient
            .from('job_applications')
            .select('*')
            .eq('id', applicationId)
            .single();
        if (error || !application) throw new Error('خطأ في جلب بيانات المتقدم.');

        const signedUrlsToGenerate = [];
        if (application.id_photo_url) signedUrlsToGenerate.push(application.id_photo_url);
        if (application.iban_certificate_url) signedUrlsToGenerate.push(application.iban_certificate_url);
        
        // --- هنا التعديل: استخدام كود صورة بدلاً من ملف ---
        let idPhotoUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 100'%3E%3Crect width='150' height='100' fill='%23f0f2f5'/%3E%3Ctext x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Cairo, sans-serif' font-size='12' fill='%23a0aec0'%3Eلا يوجد مرفق%3C/text%3E%3C/svg%3E";
        let ibanCertUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 100'%3E%3Crect width='150' height='100' fill='%23f0f2f5'/%3E%3Ctext x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Cairo, sans-serif' font-size='12' fill='%23a0aec0'%3Eلا يوجد مرفق%3C/text%3E%3C/svg%3E";

        if (signedUrlsToGenerate.length > 0) {
            const { data: signedUrls, error: urlError } = await supabaseClient
                .storage.from('job-applications').createSignedUrls(signedUrlsToGenerate, 300);
            if (!urlError) {
                idPhotoUrl = signedUrls.find(u => u.path === application.id_photo_url)?.signedUrl || idPhotoUrl;
                ibanCertUrl = signedUrls.find(u => u.path === application.iban_certificate_url)?.signedUrl || ibanCertUrl;
            }
        }
        
        const appData = application.applicant_data;
        body.innerHTML = `
            <div class="contract-display">
                <h4>بيانات المتقدم</h4>
                <p><strong>الاسم:</strong> ${appData.full_name || ''}</p>
                <p><strong>رقم الهوية:</strong> ${appData.id_number || ''}</p>
                <p><strong>رقم الجوال:</strong> ${appData.phone || ''}</p>
                <p><strong>اسم البنك:</strong> ${appData.bank_name || 'غير مسجل'}</p>
                <p><strong>الآيبان:</strong> ${appData.iban || ''}</p>
                <hr>
                <h4>المرفقات (اضغط على الصورة للتكبير)</h4>
                <div class="attachments-grid">
                    <div>
                        <h5>صورة الهوية</h5>
                        <img src="${idPhotoUrl}" alt="صورة الهوية" class="attachment-image viewable-image">
                    </div>
                    <div>
                        <h5>شهادة الآيبان</h5>
                        <img src="${ibanCertUrl}" alt="شهادة الآيبان" class="attachment-image viewable-image">
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        body.innerHTML = `<p style="color:red;">${error.message}</p>`;
    }
}
// نهاية الكود الجديد
// --- عند الضغط على "ترشيح" ---
const nominateBtn = event.target.closest('.nominate-applicant-btn');
if (nominateBtn) {
    const applicationId = nominateBtn.dataset.appid;
    const vacancyId = nominateBtn.dataset.vid;

    if (!confirm('هل أنت متأكد من ترشيح هذا المتقدم؟ سيتم إخفاء باقي المتقدمين وإرسال هذا الطلب لمدير العمليات.')) {
        return;
    }

    nominateBtn.disabled = true;
    nominateBtn.textContent = 'جاري...';

    try {
        // 1. تحديث حالة المتقدم المرشح إلى "بانتظار موافقة العمليات"
        const { error: e1 } = await supabaseClient
            .from('job_applications')
            .update({ status: 'pending_ops', supervisor_approver_id: currentUser.id })
            .eq('id', applicationId);
        if (e1) throw e1;
        
        // 2. تحديث حالة باقي المتقدمين لنفس الشاغر إلى "لم يتم الترشيح"
        const { error: e2 } = await supabaseClient
            .from('job_applications')
            .update({ status: 'not_nominated' })
            .eq('vacancy_id', vacancyId)
            .not('id', 'eq', applicationId); // كل الطلبات ما عدا الطلب المرشح
        if (e2) console.warn("Could not update other applicants:", e2);

        alert('تم ترشيح المتقدم بنجاح!');
        loadSupervisorApplicationsPage(); // إعادة تحميل الصفحة لإخفاء المجموعة

    } catch (error) {
        alert('حدث خطأ أثناء عملية الترشيح: ' + error.message);
        console.error('Nomination Error:', error);
    } finally {
        nominateBtn.disabled = false;
        nominateBtn.textContent = 'ترشيح';
    }
}
// نهاية الإضافة

// بداية الاستبدال
// بداية الاستبدال

const supervisorPermissionBtn = event.target.closest('.supervisor-permission-action-btn');
if (supervisorPermissionBtn) {
    event.stopPropagation();
    const requestId = supervisorPermissionBtn.dataset.requestId;
    const action = supervisorPermissionBtn.dataset.action;
    let updateData = {};
    supervisorPermissionBtn.disabled = true;

    try {
        if (action === 'approve') {
            if (!confirm('هل أنت متأكد من الموافقة ورفع الطلب للعمليات؟')) {
                supervisorPermissionBtn.disabled = false; return;
            }
            updateData = { 
                status: 'بانتظار موافقة العمليات', 
                supervisor_approver_id: currentUser.id 
            };
            
            // --- إرسال إشعار لمدراء العمليات ---
            const { data: requestDetails } = await supabaseClient.from('employee_requests').select('users:user_id(name)').eq('id', requestId).single();
            const { data: opsManagers, error: opsError } = await supabaseClient
                .from('users')
                .select('id')
                .eq('role', 'ادارة العمليات')
                .eq('region', currentUser.region);

            if (!opsError && opsManagers) {
                const opsIds = opsManagers.map(ops => ops.id);
                sendNotification(
                    opsIds,
                    'طلب استئذان بانتظار المراجعة',
                    `تم رفع طلب استئذان من الموظف ${requestDetails.users.name} وهو بانتظار موافقتك.`,
                    '#'
                );
            }
            // --- نهاية إرسال الإشعار ---

        } else {
            const reason = prompt('الرجاء كتابة سبب الرفض:');
            if (!reason) { supervisorPermissionBtn.disabled = false; return; }
            updateData = { 
                status: 'مرفوض', 
                rejection_reason: reason,
                supervisor_approver_id: currentUser.id
            };
        }

        const { error } = await supabaseClient.from('employee_requests').update(updateData).eq('id', requestId);
        if (error) throw error;

        alert('تم تحديث الطلب بنجاح.');
        loadSupervisorPermissionRequestsPage();

    } catch(error) {
        alert('حدث خطأ أثناء تحديث الطلب.');
        console.error(error);
    } finally {
        supervisorPermissionBtn.disabled = false;
    }
    return;
}

// نهاية الاستبدال
// نهاية الاستبدال

// بداية الاستبدال

// نهاية الإضافة
    // بداية الإضافة
// --- منطق عام لإغلاق أي نافذة منبثقة ---
if (event.target.closest('.modal-close-btn')) {
    event.target.closest('.modal-overlay').classList.add('hidden');
    return; // إيقاف التنفيذ هنا لأننا لا نحتاج لفحص أي شيء آخر
}
// نهاية الإضافة
// بداية الاستبدال
const myDirectiveTab = event.target.closest('#page-my-directives .tab-link');
if (myDirectiveTab) {
    event.preventDefault();
    const targetTabId = myDirectiveTab.dataset.tab;

    document.querySelectorAll('#page-my-directives .tab-link').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#page-my-directives .tab-content').forEach(c => c.classList.remove('active'));
    myDirectiveTab.classList.add('active');
    document.getElementById(targetTabId).classList.add('active');

    // استدعاء دالة تحميل السجل عند الضغط على تبويبه
    if (targetTabId === 'supervisor-directives-history') {
        loadSupervisorDirectivesHistory();
    }
}
// نهاية الاستبدال

// بداية الإضافة
// --- منطق التنقل بين تبويبات صفحة الزيارات/الجولات ---
const visitPatrolTab = event.target.closest('#page-visits .tab-link');
if (visitPatrolTab) {
    event.preventDefault();
    const targetTabId = visitPatrolTab.dataset.tab;

    document.querySelectorAll('#page-visits .tab-link').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#page-visits .tab-content').forEach(c => c.classList.remove('active'));
    visitPatrolTab.classList.add('active');
    document.getElementById(targetTabId).classList.add('active');

    if (targetTabId === 'patrols-log') {
        loadPatrolsHistory();
    }
}

// --- منطق عرض مسار الجولة على الخريطة ---
const viewPathBtn = event.target.closest('.view-patrol-path-btn');
if (viewPathBtn) {
    const patrolId = viewPathBtn.dataset.patrolId;
    const { data: patrol, error } = await supabaseClient
        .from('patrols')
        .select('path')
        .eq('id', patrolId)
        .single();

    if (error || !patrol || !patrol.path || patrol.path.length === 0) {
        return alert('لا يوجد مسار مسجل لهذه الجولة أو حدث خطأ.');
    }

    // الانتقال إلى صفحة الخريطة
    document.querySelector('a[data-page="page-geo"]').click();

    // إعطاء مهلة بسيطة للخريطة للتحميل قبل رسم المسار
    setTimeout(() => {
        // مسح أي طبقات قديمة على الخريطة
        markersLayer.clearLayers();

        const latLngs = patrol.path.map(p => [p.lat, p.lng]);
        const polyline = L.polyline(latLngs, { color: 'blue' }).addTo(markersLayer);

        // إضافة علامات البداية والنهاية
        const startMarker = L.marker(latLngs[0]).bindPopup('بداية الجولة').addTo(markersLayer);
        const endMarker = L.marker(latLngs[latLngs.length - 1]).bindPopup('نهاية الجولة').addTo(markersLayer);

        // تكبير الخريطة لتناسب المسار
        map.fitBounds(polyline.getBounds());
    }, 500);
}
// نهاية الإضافة

// بداية الاستبدال
// منطق فتح نافذة تسجيل الزيارة للمشرف (يعتمد على العقد)
const addVisitLogBtn = event.target.closest('#add-visit-log-btn');
if (addVisitLogBtn && currentUser && currentUser.contract_id) {
    const modal = document.getElementById('add-visit-modal');
    const locationSelect = document.getElementById('visit-client-select'); // سنستخدم نفس الحقل ولكن بتسمية مختلفة
    const visitTimeInput = document.getElementById('visit-time-input');

    modal.classList.remove('hidden');
    locationSelect.innerHTML = '<option>جاري تحميل مواقع العقد...</option>';

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    visitTimeInput.value = now.toISOString().slice(0, 16);

    // جلب العقد المحدد للمشرف
    const { data: contract, error } = await supabaseClient
        .from('contracts')
        .select('locations_and_guards')
        .eq('id', currentUser.contract_id)
        .single();

    if (error || !contract || !contract.locations_and_guards) {
        locationSelect.innerHTML = '<option>خطأ أو لا توجد مواقع في عقدك</option>';
        return console.error(error);
    }

    // تعبئة القائمة بالمواقع من داخل العقد
    locationSelect.innerHTML = contract.locations_and_guards.map(loc => 
        `<option value="${loc.location_name}">${loc.location_name}</option>`
    ).join('');
}
// نهاية الاستبدال

// بداية الاستبدال
// منطق الرد على التوجيهات (مع ملاحظات القبول الاختيارية)
const directiveActionBtn = event.target.closest('.directive-action-btn');
if (directiveActionBtn) {
    const directiveId = directiveActionBtn.dataset.directiveId;
    const action = directiveActionBtn.dataset.action;
    let updateData = { status: action, updated_at: new Date() };

    if (action === 'accepted') {
        // اسأل عن ملاحظات اختيارية عند القبول
        const notes = prompt('هل لديك أي ملاحظات؟ (اختياري)');
        // إذا كتب المستخدم ملاحظات (حتى لو كانت مسافة فارغة)، قم بإضافتها
        if (notes !== null) {
            updateData.acceptance_notes = notes;
        }
    } else if (action === 'rejected') {
        const reason = prompt('الرجاء كتابة سبب الرفض:');
        if (reason) {
            updateData.rejection_reason = reason;
        } else {
            return; // أوقف العملية إذا لم يكتب المستخدم سبباً للرفض
        }
    }
    
    directiveActionBtn.disabled = true;

    const { error } = await supabaseClient
        .from('directives')
        .update(updateData)
        .eq('id', directiveId);

    if (error) {
        alert('حدث خطأ أثناء الرد على التوجيه.');
        console.error(error);
        directiveActionBtn.disabled = false;
    } else {
        alert('تم تسجيل ردك بنجاح.');
        loadMyDirectivesPage(); // تحديث الواجهة
    }
}
// نهاية الاستبدال
    // بداية الإضافة: منطق إرسال التوجيه والتحكم بالتبويبات
// ========= بداية الاستبدال الكامل لمنطق حفظ التوجيه =========
// بداية الاستبدال

const sendDirectiveBtn = event.target.closest('#send-directive-btn');
if (sendDirectiveBtn) {
    const recipientId = document.getElementById('directive-recipient-id').value;
    const content = document.getElementById('directive-content').value;

    if (!content.trim()) return alert('الرجاء كتابة نص التوجيه.');

    sendDirectiveBtn.disabled = true;
    sendDirectiveBtn.textContent = 'جاري الإرسال...';

    try {
            if (recipientId === 'all') {
                let query = supabaseClient
                    .from('users')
                    .select('id');
                
                // --- هنا التصحيح: استخدام الدالة المساعدة للفلترة ---
                query = createProjectFilter(query, currentUser.project);
                
                const { data: guards, error: guardsError } = await query
                    .or('role.eq.حارس أمن,role.eq.مشرف');

            if (guardsError) throw guardsError;

            const directives = guards.map(guard => ({
                sender_id: currentUser.id,
                recipient_id: guard.id,
                content: content
            }));

            const { error: insertError } = await supabaseClient.from('directives').insert(directives);
            if (insertError) throw insertError;

            // --- الإضافة الجديدة: إرسال الإشعارات للجميع ---
            const guardIds = guards.map(g => g.id);
            sendNotification(
                guardIds,
                `توجيه جديد من: ${currentUser.name}`,
                content,
                '#' // يمكنك تغيير الرابط لاحقاً لصفحة التوجيهات
            );
            // --- نهاية الإضافة ---

            alert(`تم إرسال التوجيه بنجاح إلى ${guards.length} موظف.`);

        } else {
            const { error } = await supabaseClient
                .from('directives')
                .insert({ sender_id: currentUser.id, recipient_id: recipientId, content: content });

            if (error) throw error;

            // --- الإضافة الجديدة: إرسال الإشعار للمستلم ---
            sendNotification(
                parseInt(recipientId),
                `توجيه جديد من: ${currentUser.name}`,
                content,
                '#'
            );
            // --- نهاية الإضافة ---

            alert('تم إرسال التوجيه بنجاح.');
        }

        document.getElementById('send-directive-modal').classList.add('hidden');

    } catch (error) {
        alert('حدث خطأ أثناء إرسال التوجيه: ' + error.message);
    } finally {
        sendDirectiveBtn.disabled = false;
        sendDirectiveBtn.textContent = 'إرسال';
    }
}

// نهاية الاستبدال
// ========= نهاية الاستبدال الكامل لمنطق حفظ التوجيه =========

// --- منطق التنقل بين تبويبات صفحة التوجيهات ---
const directiveTab = event.target.closest('#page-directives-ops .tab-link');
if (directiveTab) {
    event.preventDefault();
    const targetTabId = directiveTab.dataset.tab;

    // تفعيل التبويب والصفحة المرتبطة به
    document.querySelectorAll('#page-directives-ops .tab-link').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#page-directives-ops .tab-content').forEach(c => c.classList.remove('active'));
    directiveTab.classList.add('active');
    document.getElementById(targetTabId).classList.add('active');

    // تحميل محتوى التبويب المطلوب
    if (targetTabId === 'ops-directives-history') {
        loadOpsDirectivesHistory();
    }
}
// نهاية الإضافة

    // بداية الإضافة: منطق فتح نافذة إرسال التوجيه
const openDirectiveModalBtn = event.target.closest('.open-directive-modal-btn');
if (openDirectiveModalBtn) {
    const recipientId = openDirectiveModalBtn.dataset.recipientId;
    const recipientName = openDirectiveModalBtn.dataset.recipientName;
    
    const modal = document.getElementById('send-directive-modal');
    document.getElementById('send-directive-modal-title').textContent = `إرسال توجيه إلى: ${recipientName}`;
    document.getElementById('directive-recipient-id').value = recipientId;
    document.getElementById('directive-content').value = ''; // إفراغ الحقل عند الفتح

    modal.classList.remove('hidden');
}
// نهاية الإضافة

    // بداية الاستبدال
// منطق الموارد البشرية للقبول النهائي (مع إنشاء حساب للموظف)
const hrCoverageBtn = event.target.closest('.hr-coverage-action-btn');
if (hrCoverageBtn) {
    const applicantId = hrCoverageBtn.dataset.applicantId;
    const shiftId = hrCoverageBtn.dataset.shiftId;
    const action = hrCoverageBtn.dataset.action;

    hrCoverageBtn.disabled = true;
    hrCoverageBtn.textContent = 'جاري...';

    try {
        if (action === 'approve') {
            if (!confirm('هل أنت متأكد من القبول النهائي؟ سيتم إنشاء حساب للموظف وإغلاق الوردية.')) {
                hrCoverageBtn.disabled = false; hrCoverageBtn.innerHTML = '<i class="ph-bold ph-check-circle"></i> قبول نهائي وتعيين'; return;
            }

            // --- جلب بيانات المتقدم والوردية ---
            const { data: applicant, error: applicantError } = await supabaseClient.from('coverage_applicants').select('*, coverage_shifts(*)').eq('id', applicantId).single();
            if (applicantError || !applicant) throw new Error('لا يمكن العثور على بيانات المتقدم.');
            
            // --- تجهيز بيانات الموظف الجديد ---
            const profileData = {
                name: applicant.full_name,
                id_number: applicant.id_number,
                phone: applicant.phone_number,
                iban: applicant.iban,
                role: 'حارس أمن',
                employee_type: 'تغطية',
                employment_status: 'نشط',
                status: 'active',
                project: applicant.coverage_shifts.project,
                location: applicant.coverage_shifts.location,
                region: applicant.coverage_shifts.region,
                city: applicant.coverage_shifts.city,
                vacancy_id: applicant.coverage_shifts.linked_vacancy_id || null
            };

            // --- استدعاء الدالة السحابية لإنشاء الموظف ---
            // نستخدم رقم الهوية ككلمة مرور افتراضية
            const { data: functionResponse, error: functionError } = await supabaseClient.functions.invoke('create-employee', {
                body: { password: profileData.id_number, ...profileData }
            });

            if (functionError) throw new Error(`فشل في إنشاء الموظف: ${functionError.message}`);
            if (functionResponse.error) throw new Error(`خطأ من الخادم: ${functionResponse.error}`);

            // --- إذا نجح كل شيء، نحدّث حالة الطلبات والوردية ---
            await supabaseClient.from('coverage_applicants').update({ status: 'hr_approved' }).eq('id', applicantId);
            await supabaseClient.from('coverage_shifts').update({ status: 'closed' }).eq('id', shiftId);
            await supabaseClient.from('coverage_applicants').update({ status: 'rejected', rejection_reason: 'تم اختيار متقدم آخر' }).eq('shift_id', shiftId).not('id', 'eq', applicantId);

            alert(`تم إنشاء حساب الموظف بنجاح! \nاسم المستخدم: ${profileData.id_number}\nكلمة المرور: ${profileData.id_number}\nالرجاء إبلاغ الموظف بتغيير كلمة المرور بعد أول تسجيل دخول.`);

        } else { // الرفض
            const reason = prompt("الرجاء كتابة سبب الرفض:");
            if (reason) {
                const { error } = await supabaseClient.from('coverage_applicants').update({ status: 'rejected', rejection_reason: reason }).eq('id', applicantId);
                if (error) throw error;
                alert('تم رفض المتقدم.');
            }
        }
        
        loadCoverageRequestsPage(); // تحديث الواجهة

    } catch (error) {
        alert(`حدث خطأ فادح: ${error.message}`);
    } finally {
        hrCoverageBtn.disabled = false;
        hrCoverageBtn.innerHTML = '<i class="ph-bold ph-check-circle"></i> قبول نهائي وتعيين';
    }
}
// نهاية الاستبدال
// ========= بداية الإضافة (أضف هذا في نهاية الملف) =========






// بداية الاستبدال

/**
 * دالة متكاملة لتهيئة وتسجيل الإشعارات (النسخة النهائية والمستقرة)
 * @param {HTMLButtonElement} btn - الزر الذي تم الضغط عليه لتحديث حالته
 */
async function setupPushNotifications(btn) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('المتصفح لا يدعم الإشعارات.');
        btn.disabled = false;
        return;
    }

    try {
        console.log('طلب الإذن من المستخدم...');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            throw new Error('تم رفض إذن الإشعارات.');
        }

        // --- الخطوة الجديدة: انتظر حتى يصبح الـ Service Worker نشطاً ---
        console.log('الانتظار حتى يصبح ملف الإشعارات جاهزاً...');
        const readySW = await navigator.serviceWorker.ready;
        console.log('ملف الإشعارات جاهز ونشط!', readySW);
        
        console.log('طلب توكن FCM...');
        
        
        const fcmToken = await messaging.getToken({ 
            vapidKey: config.vapidKey,
            serviceWorkerRegistration: readySW // نمرر له النسخة الجاهزة
        });

        if (fcmToken) {
            console.log('تم الحصول على التوكن بنجاح:', fcmToken);
            await supabaseClient
                .from('users')
                .update({ fcm_token: fcmToken })
                .eq('id', currentUser.id);
            
            alert('تم تفعيل الإشعارات بنجاح!');
            btn.style.color = '#22c55e';
        } else {
             throw new Error('لم يتمكن من الحصول على توكن.');
        }

    } catch (err) {
        console.error('حدث خطأ أثناء إعداد الإشعارات:', err);
        // عرض الرسالة التي ظهرت في الصورة للمستخدم
        alert(`فشل تفعيل الإشعارات:\n${err.message}`);
    } finally {
        btn.disabled = false;
    }
}

// نهاية الاستبدال
// ========= نهاية الإضافة =========

// بداية الإضافة
async function loadSupervisorDirectivesHistory() {
    const container = document.getElementById('supervisor-history-list-container');
    if (!container || !currentUser) return;
    container.innerHTML = '<p style="text-align: center;">جاري تحميل السجل...</p>';

    const { data: directives, error } = await supabaseClient
        .from('directives')
        .select(`*, recipient:recipient_id (name)`)
        .eq('sender_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = '<p style="color:red;">خطأ في جلب السجل.</p>';
        return console.error(error);
    }
    if (directives.length === 0) {
        container.innerHTML = '<p style="text-align: center;">لم تقم بإرسال أي توجيهات بعد.</p>';
        return;
    }

    container.innerHTML = directives.map(d => {
        let statusClass, statusText;
        switch(d.status) {
            case 'accepted': statusClass = 'active'; statusText = 'تم القبول'; break;
            case 'rejected': statusClass = 'inactive'; statusText = 'تم الرفض'; break;
            default: statusClass = 'pending'; statusText = 'مرسل';
        }
        const date = new Date(d.created_at).toLocaleString('ar-SA');
        
        let notesFooter = '';
        if (d.status === 'rejected' && d.rejection_reason) {
            notesFooter = `<div class="request-card-footer"><strong>سبب الرفض:</strong> ${d.rejection_reason}</div>`;
        } else if (d.status === 'accepted' && d.acceptance_notes) {
            notesFooter = `<div class="request-card-footer" style="background-color: #e6f7ff; color: #005f8a; border-top: 1px solid #b3e0ff;"><strong>ملاحظات القبول:</strong> ${d.acceptance_notes}</div>`;
        }
        
        return `
            <div class="request-card" style="margin-bottom:15px;">
                <div class="request-card-header">
                    <h4>إلى: ${d.recipient ? d.recipient.name : 'مستخدم محذوف'}</h4>
                    <span class="status ${statusClass}">${statusText}</span>
                </div>
                <div class="request-card-body">
                    <p>${d.content}</p>
                    <small style="color: var(--text-secondary);">${date}</small>
                    ${notesFooter}
                </div>
            </div>`;
    }).join('');
}
// نهاية الإضافة
// بداية الإضافة
// --- منطق تسجيل الخروج ---
if (event.target.closest('#logout-btn, #logout-btn-mobile')) {
    event.preventDefault(); // منع السلوك الافتراضي للرابط
    
    if (confirm('هل أنت متأكد من رغبتك في تسجيل الخروج؟')) {
        const { error } = await supabaseClient.auth.signOut();
        
        if (error) {
            alert('حدث خطأ أثناء تسجيل الخروج: ' + error.message);
        } else {
            // مسح أي بيانات محفوظة للمستخدم من الجلسة الحالية
            currentUser = null;
            sessionStorage.removeItem('currentUser');
            
            // إعادة تحميل الصفحة للعودة إلى شاشة تسجيل الدخول
            location.reload();
        }
    }
}
// نهاية الإضافة
    // بداية الإضافة: منطق تعديل وحذف التغطيات


// نهاية الإضافة

    // بداية الإضافة: منطق إنشاء تغطية جديدة من قبل مدير العمليات

// --- عند الضغط على زر "إنشاء تغطية جديدة" ---
const addNewCoverageBtn = event.target.closest('#add-new-coverage-btn');
if (addNewCoverageBtn) {
    const modal = document.getElementById('create-coverage-modal');
    const vacancySelect = document.getElementById('coverage-link-vacancy');
    
    // إعادة تعيين الفورم
    modal.querySelectorAll('input, select').forEach(el => {
        if(el.id !== 'coverage-link-vacancy' && el.id !== 'coverage-new-reason') el.value = '';
        el.disabled = false;
    });
    vacancySelect.innerHTML = '<option value="">جاري تحميل الشواغر...</option>';
    
    // جلب الشواغر المفتوحة فقط
    const { data: vacancies, error } = await supabaseClient
        .from('job_vacancies')
        .select('id, project, specific_location')
        .eq('status', 'open');
        
    if (error) {
        vacancySelect.innerHTML = '<option value="">خطأ في التحميل</option>';
    } else {
        vacancySelect.innerHTML = '<option value="">-- تغطية يدوية بدون ربط بشاغر --</option>';
        vacancies.forEach(v => {
            vacancySelect.innerHTML += `<option value="${v.id}">${v.project} - ${v.specific_location || 'موقع عام'}</option>`;
        });
    }
    
    modal.classList.remove('hidden');
}

// بداية الاستبدال
// --- عند حفظ التغطية (للإنشاء والتعديل) ---
// --- عند حفظ التغطية (للإنشاء والتعديل) ---
const saveNewCoverageBtn = event.target.closest('#save-new-coverage-btn');
if (saveNewCoverageBtn) {
    const editId = document.getElementById('coverage-edit-id').value;
    const vacancyId = document.getElementById('coverage-link-vacancy').value;
    const coverageData = {
        project: document.getElementById('coverage-new-project').value,
        location: document.getElementById('coverage-new-location').value,
        region: document.getElementById('coverage-new-region').value,
        city: document.getElementById('coverage-new-city').value,
        start_time: document.getElementById('coverage-new-start-time').value,
        end_time: document.getElementById('coverage-new-end-time').value,
        coverage_pay: parseFloat(document.getElementById('coverage-new-pay').value) || 0,
        reason: document.getElementById('coverage-new-reason').value,
        linked_vacancy_id: vacancyId || null,
        created_by: currentUser.id
    };

    if (!coverageData.project || !coverageData.location || !coverageData.start_time || !coverageData.end_time || coverageData.coverage_pay <= 0) {
        return alert('الرجاء تعبئة حقول المشروع، الموقع، الوقت، وقيمة التغطية بشكل صحيح.');
    }
    
    saveNewCoverageBtn.disabled = true;
    saveNewCoverageBtn.textContent = 'جاري الحفظ...';
    
    let error, action_type;

    if (editId) {
        // ----- وضع التعديل -----
        ({ error } = await supabaseClient.from('coverage_shifts').update(coverageData).eq('id', editId));
        action_type = 'تعديل تغطية';
    } else {
        // ----- وضع الإنشاء -----
        coverageData.status = 'open';
        ({ error } = await supabaseClient.from('coverage_shifts').insert(coverageData));
        action_type = 'إنشاء تغطية';
        
        if (vacancyId && !error) {
            await supabaseClient.from('job_vacancies').update({ status: 'on_coverage' }).eq('id', vacancyId);
        }
    }
        
    if (error) {
        showToast('حدث خطأ أثناء حفظ التغطية.', 'error');
    } else {
        showToast(editId ? 'تم تعديل التغطية بنجاح!' : 'تم طرح وردية التغطية بنجاح!', 'success');
        document.getElementById('create-coverage-modal').classList.add('hidden');
        await supabaseClient.from('audit_logs').insert({ user_name: currentUser.name, action_type: action_type, details: { project: coverageData.project, location: coverageData.location } });
        loadCoveragePage();
    }
    
    saveNewCoverageBtn.disabled = false;
    saveNewCoverageBtn.textContent = 'حفظ وطرح للتغطية';
}
// نهاية الاستبدال

// نهاية الإضافة

    // بداية الإضافة: منطق عرض وقبول/رفض المتقدمين للتغطية

// عند الضغط على زر "عرض المتقدمين"
const viewApplicantsBtn = event.target.closest('.view-applicants-btn');
if (viewApplicantsBtn) {
    const shiftId = viewApplicantsBtn.dataset.shiftId;
    const modal = document.getElementById('view-applicants-modal');
    const body = document.getElementById('applicants-list-body');
    
    modal.classList.remove('hidden');
    body.innerHTML = '<p style="text-align:center;">جاري تحميل المتقدمين...</p>';
    
    // جلب المتقدمين الذين حالتهم "معلق" لهذه الوردية
    const { data: applicants, error } = await supabaseClient
        .from('coverage_applicants')
        .select('*')
        .eq('shift_id', shiftId)
        .eq('status', 'pending');
        
    if (error) {
        body.innerHTML = '<p style="text-align:center; color:red;">حدث خطأ.</p>';
        return console.error(error);
    }
    
    if (applicants.length === 0) {
        body.innerHTML = '<p style="text-align:center;">لا يوجد متقدمون جدد لهذه الوردية.</p>';
        return;
    }
    
    // بناء جدول لعرض المتقدمين
    body.innerHTML = `
        <div class="table-container" style="padding:0; box-shadow:none;">
            <table>
                <thead>
                    <tr>
                        <th>الاسم</th>
                        <th>رقم الهوية</th>
                        <th>الجوال</th>
                        <th>إجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    ${applicants.map(applicant => `
                        <tr>
                            <td>${applicant.full_name}</td>
                            <td>${applicant.id_number}</td>
                            <td>${applicant.phone_number}</td>
                            <td>
                                <button class="btn btn-success btn-sm coverage-action-btn" data-action="approve" data-applicant-id="${applicant.id}">
                                    <i class="ph-bold ph-check"></i> قبول مبدئي
                                </button>
                                <button class="btn btn-danger btn-sm coverage-action-btn" data-action="reject" data-applicant-id="${applicant.id}">
                                    <i class="ph-bold ph-x"></i> رفض
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// عند الضغط على زر "قبول مبدئي" أو "رفض" للمتقدم
const coverageActionBtn = event.target.closest('.coverage-action-btn');
if (coverageActionBtn) {
    const applicantId = coverageActionBtn.dataset.applicantId;
    const action = coverageActionBtn.dataset.action;

    if (!confirm(`هل أنت متأكد من ${action === 'approve' ? 'القبول المبدئي' : 'رفض'} هذا المتقدم؟`)) {
        return;
    }
    
    let updateData = {};
    if (action === 'approve') {
        updateData.status = 'ops_approved'; // تحديث الحالة إلى "مقبول من العمليات"
    } else {
        const reason = prompt("الرجاء كتابة سبب الرفض:");
        if (!reason) return; // إذا لم يكتب المستخدم سبباً
        updateData.status = 'rejected';
        updateData.rejection_reason = reason;
    }
    
    coverageActionBtn.disabled = true;
    coverageActionBtn.textContent = 'جاري...';
    
    const { error } = await supabaseClient
        .from('coverage_applicants')
        .update(updateData)
        .eq('id', applicantId);
        
    if (error) {
        alert('حدث خطأ!');
        console.error(error);
        coverageActionBtn.disabled = false;
    } else {
        alert('تم تحديث حالة المتقدم بنجاح.');
        // إزالة الصف من الجدول في الواجهة فوراً
        coverageActionBtn.closest('tr').remove();
        // إعادة تحميل صفحة التغطيات في الخلفية لتحديث عدد المتقدمين
        loadCoveragePage();
    }
}

// نهاية الإضافة

    // بداية الإضافة: منطق إضافة وردية للتغطية
// بداية الاستبدال
// بداية الإضافة: منطق إضافة وردية للتغطية (نسخة مطورة)
// عند الضغط على زر "إضافة للتغطية"
const addToCoverageBtn = event.target.closest('.add-to-coverage-btn');
if (addToCoverageBtn) {
    const modal = document.getElementById('add-to-coverage-modal');
    
    // الحالة الأولى: الزر قادم من صفحة "حضور الحراس" ويحتوي على بيانات وردية
    if (addToCoverageBtn.dataset.shift) {
        const shiftData = JSON.parse(addToCoverageBtn.dataset.shift);

        // تعبئة النافذة ببيانات الوردية للغائب
        document.getElementById('coverage-start-time').value = shiftData.start_time || '';
        document.getElementById('coverage-end-time').value = shiftData.end_time || '';
        document.getElementById('coverage-pay').value = ''; // يترك فارغاً لمدير العمليات
        document.getElementById('coverage-reason').value = 'غياب'; // سبب افتراضي
        
        // حفظ بيانات الوردية الأصلية كاملة
        document.getElementById('coverage-original-shift-details').value = JSON.stringify(shiftData);
        modal.classList.remove('hidden');

    } 
    // الحالة الثانية: الزر قادم من صفحة "التوظيف" ويحتوي على هوية الشاغر
    else if (addToCoverageBtn.dataset.id) { 
        const vacancyId = addToCoverageBtn.dataset.id;
        
        // جلب بيانات الشاغر من قاعدة البيانات
        const { data: vacancy, error } = await supabaseClient
            .from('job_vacancies')
            .select('project, location, region, city, specific_location')
            .eq('id', vacancyId)
            .single();
            
        if (error || !vacancy) {
            return alert('خطأ في جلب بيانات الشاغر المحدد.');
        }

        // تعبئة النافذة، مع ترك الأوقات فارغة للمستخدم
        document.getElementById('coverage-start-time').value = '';
        document.getElementById('coverage-end-time').value = '';
        document.getElementById('coverage-pay').value = '';
        document.getElementById('coverage-reason').value = 'شاغر مؤقت'; // سبب افتراضي مختلف
        
        // تجهيز البيانات التي سيتم حفظها في جدول التغطيات
        const coverageDetails = {
            project: vacancy.project,
            // استخدام الموقع المحدد إذا كان موجوداً، وإلا استخدام موقع المدينة
            location: vacancy.specific_location || vacancy.location, 
            region: vacancy.region,
            city: vacancy.city
        };
        document.getElementById('coverage-original-shift-details').value = JSON.stringify(coverageDetails);
        modal.classList.remove('hidden');
    }
}
// نهاية الاستبدال

// عند الضغط على زر "حفظ وطرح للتغطية"
// عند الضغط على زر "حفظ وطرح للتغطية"
const saveCoverageBtn = event.target.closest('#save-coverage-shift-btn');
if (saveCoverageBtn) {
    const originalShift = JSON.parse(document.getElementById('coverage-original-shift-details').value);
    
    let cleanProjectName = originalShift.project;
    if (Array.isArray(cleanProjectName)) {
        cleanProjectName = cleanProjectName.join('');
    } else if (typeof cleanProjectName === 'string') {
        cleanProjectName = cleanProjectName.replace(/[\[\]",]/g, '').trim();
    }

    const newCoverageShift = {
        project: cleanProjectName,
        location: originalShift.location,
        region: originalShift.region,
        city: originalShift.city,
        start_time: document.getElementById('coverage-start-time').value,
        end_time: document.getElementById('coverage-end-time').value,
        coverage_pay: parseFloat(document.getElementById('coverage-pay').value) || 0,
        reason: document.getElementById('coverage-reason').value,
        status: 'open',
        created_by: currentUser.id,
        linked_vacancy_id: originalShift.linked_vacancy_id || null,
        covered_user_id: originalShift.absent_guard_id || null
    };

    if (!newCoverageShift.coverage_pay || newCoverageShift.coverage_pay <= 0) {
        return alert('الرجاء إدخال قيمة التغطية بشكل صحيح.');
    }
    
    saveCoverageBtn.disabled = true;
    saveCoverageBtn.textContent = 'جاري الحفظ...';

    const { error } = await supabaseClient.from('coverage_shifts').insert([newCoverageShift]);
    
    if (error) {
        alert('حدث خطأ أثناء حفظ وردية التغطية.');
        console.error("Save Coverage Error:", error);
    } else {
        // --- بداية الإضافة: تحديث حالة الشاغر ---
        if (newCoverageShift.linked_vacancy_id) {
            await supabaseClient
                .from('job_vacancies')
                .update({ is_temporarily_covered: true })
                .eq('id', newCoverageShift.linked_vacancy_id);
        }
        // --- نهاية الإضافة ---

        alert('تم طرح الوردية للتغطية بنجاح!');
        document.getElementById('add-to-coverage-modal').classList.add('hidden');
        loadUncoveredNeeds();
        loadCoveragePage();
    }

    saveCoverageBtn.disabled = false;
    saveCoverageBtn.textContent = 'حفظ وطرح للتغطية';
}
// نهاية الإضافة

// بداية الكود الجديد والمُصحح
if (event.target.id === 'export-payroll-btn') {
    if (payrollExportData && payrollExportData.length > 0) {
        const startDate = document.getElementById('payroll-start-date').value;
        const endDate = document.getElementById('payroll-end-date').value;
        const filename = `مسير رواتب من ${startDate} إلى ${endDate}.xlsx`;
        exportPayrollToExcel(payrollExportData, filename); // استدعاء الدالة الجديدة
    } else {
        alert('لا توجد بيانات لتصديرها. يرجى توليد المسير أولاً.');
    }
}
// نهاية الكود الجديد والمُصحح
// نهاية الإضافة
    // بداية الإضافة
// زر توليد مسير الرواتب
if (event.target.id === 'generate-payroll-btn') {
    generatePayroll();
}
// نهاية الإضافة

// بداية الإضافة

// بداية الاستبدال
// ========= بداية الاستبدال الكامل لمنطق أزرار الطلبات =========
// بداية الاستبدال

const requestActionBtn = event.target.closest('.request-action-button');
if (requestActionBtn) {
    event.stopPropagation();
    const btn = requestActionBtn;
    btn.disabled = true;

    const action = btn.dataset.action;
    const requestId = btn.dataset.requestId;
    const stage = btn.dataset.approvalStage;
    const requestType = btn.dataset.requestType;
    const userId = btn.dataset.userId;
    const vacancyId = btn.dataset.vacancyId;

    try {
        let updateData = {};
        let successMessage = '';
        let notifyHR = false;

        if (action === 'reject') {
            const reason = prompt('الرجاء إدخال سبب الرفض:');
            if (!reason) { btn.disabled = false; return; }
            updateData = { status: 'مرفوض', rejection_reason: reason };
            successMessage = 'تم رفض الطلب بنجاح.';
        } else if (action === 'approve') {
            if (!confirm('هل أنت متأكد من الموافقة على هذا الإجراء؟')) { btn.disabled = false; return; }

            switch (stage) {
                case 'ops_escalate':
                    updateData = { status: 'بانتظار موافقة الموارد البشرية', ops_approver_id: currentUser.id };
                    successMessage = 'تم رفع الطلب للموارد البشرية.';
                    notifyHR = true; // تفعيل إرسال الإشعار للموارد البشرية
                    break;
                
                case 'hr_final':
                    updateData = { status: 'مقبول' };
                    successMessage = 'تمت الموافقة النهائية على الطلب.';
                    
                    // إرسال إشعار للموظف صاحب الطلب
                    sendNotification(
                        parseInt(userId),
                        'تحديث على طلبك',
                        `تمت الموافقة النهائية على طلب ${requestType} الذي قدمته.`,
                        '#'
                    );

                    if ((requestType === 'leave' || requestType === 'resignation') && vacancyId) {
                        await supabaseClient.from('users').update({ vacancy_id: null, employment_status: requestType === 'leave' ? 'اجازة' : 'مستقيل' }).eq('id', userId);
                        await supabaseClient.from('job_vacancies').update({ status: 'open' }).eq('id', vacancyId);
                        successMessage += ' وتم إخلاء الشاغر الوظيفي.';
                    }
                    break;

                default: // حالة خاصة لطلبات الاستئذان التي لا تذهب للموارد البشرية
                    updateData = { status: 'مقبول' };
                    successMessage = 'تمت الموافقة النهائية على طلب الاستئذان.';
                    sendNotification(
                        parseInt(userId), 'تحديث على طلبك', `تمت الموافقة النهائية على طلب استئذانك.`, '#'
                    );
                    break;
            }
        }

        const { error } = await supabaseClient.from('employee_requests').update(updateData).eq('id', requestId);
        if (error) throw error;
        
        // منطق إرسال الإشعار للموارد البشرية
        if (notifyHR) {
            const { data: requestDetails } = await supabaseClient.from('employee_requests').select('request_type, users:user_id(name)').eq('id', requestId).single();
            const { data: hrUsers, error: hrError } = await supabaseClient.from('users').select('id').eq('role', 'ادارة الموارد البشرية');

            if (!hrError && hrUsers) {
                const hrIds = hrUsers.map(hr => hr.id);
                const typeTranslations = { leave: 'إجازة', resignation: 'استقالة', loan: 'سلفة', permission: 'استئذان' };
                const typeText = typeTranslations[requestDetails.request_type] || 'جديد';
                
                sendNotification(
                    hrIds,
                    `طلب ${typeText} بانتظار المراجعة`,
                    `تم رفع طلب ${typeText} من الموظف ${requestDetails.users.name} وهو بانتظار موافقتك النهائية.`,
                    '#'
                );
            }
        }

        alert(successMessage);

    } catch (error) {
        alert(`حدث خطأ: ${error.message}`);
    } finally {
        btn.disabled = false;
        // إعادة تحميل محتوى الصفحات المفتوحة لتحديث البيانات
        if (document.querySelector('#page-leave-requests:not(.hidden)')) loadLeaveRequests();
        if (document.querySelector('#page-resignation-requests:not(.hidden)')) loadResignationRequests();
        if (document.querySelector('#page-loan-requests:not(.hidden)')) loadLoanRequests();
        if (document.querySelector('#page-ops-review-requests:not(.hidden)')) loadOpsReviewRequestsPage();
    }
    return;
}

// نهاية الاستبدال
// ========= نهاية الاستبدال الكامل لمنطق أزرار الطلبات =========
// نهاية الإضافة

    // --- عند الضغط على زر "عرض الشواغر المتاحة" (النسخة الصحيحة) ---
    const viewSlotsBtn = event.target.closest('#view-available-slots-btn');
    if (viewSlotsBtn) {
        const modal = document.getElementById('available-slots-modal');
        const body = document.getElementById('available-slots-body');
        modal.classList.remove('hidden');
        body.innerHTML = '<p style="text-align: center;">جاري حساب الشواغر المتاحة...</p>';

        try {
            const { data: contracts, error: e1 } = await supabaseClient.from('contracts').select('id, company_name, contract_locations').eq('status', 'active');
            const { data: vacancies, error: e2 } = await supabaseClient.from('job_vacancies').select('contract_id, specific_location, schedule_details');
            if (e1 || e2) throw new Error('فشل جلب البيانات.');

            let resultsHtml = `<div class="table-container"><table>
                <thead><tr><th>المشروع (العقد)</th><th>الموقع</th><th>الوردية</th><th>المطلوب</th><th>المُنشأ</th><th>المتبقي</th></tr></thead><tbody>`;
            let hasAvailableSlots = false;
            
            contracts.forEach(contract => {
                if (!contract.contract_locations) return;

                contract.contract_locations.forEach(location => {
                    if (!location.shifts) return;

                    location.shifts.forEach(shift => {
                        const requiredGuards = parseInt(shift.guards_count) || 0;
                        
                        // حساب عدد الشواغر التي تم إنشاؤها لهذه الوردية تحديداً
                        const createdVacancies = vacancies.filter(v => {
                            const vShift = v.schedule_details?.[0];
                            return v.contract_id === contract.id && 
                                   v.specific_location === location.name && 
                                   vShift && vShift.name === shift.name &&
                                   vShift.start_time === shift.start_time;
                        }).length;

                        const remaining = requiredGuards - createdVacancies;

                        if (remaining > 0) {
                            hasAvailableSlots = true;
                            resultsHtml += `<tr>
                                <td>${contract.company_name}</td>
                                <td>${location.name}</td>
                                <td>${shift.name || 'وردية'} (من ${shift.start_time || '؟'} إلى ${shift.end_time || '؟'})</td>
                                <td>${requiredGuards}</td>
                                <td>${createdVacancies}</td>
                                <td><strong style="color: #22c55e;">${remaining}</strong></td>
                            </tr>`;
                        }
                    });
                });
            });

            if (!hasAvailableSlots) {
                body.innerHTML = '<p style="text-align: center; padding: 20px;">لا توجد شواغر متاحة حالياً في أي من العقود النشطة.</p>';
            } else {
                resultsHtml += '</tbody></table></div>';
                body.innerHTML = resultsHtml;
            }

        } catch (error) {
            body.innerHTML = `<p style="text-align: center; color: red;">${error.message}</p>`;
        }
    }
// نهاية الإضافة
    // بداية الإضافة: منطق تعديل بيانات الموظف
    // بداية الاستبدال

    const editEmployeeBtn = event.target.closest('.edit-employee-btn');
    if (editEmployeeBtn) {
        const userId = editEmployeeBtn.dataset.id;
        if (!userId) return;
    
        const { data: employee, error } = await supabaseClient.from('users').select('*, job_vacancies!users_vacancy_id_fkey(*)').eq('id', userId).single();
        if (error || !employee) {
            console.error('Employee fetch error:', error);
            return alert('حدث خطأ في جلب بيانات الموظف.');
        }
    
        const modal = document.getElementById('employee-modal');
        
        // تعبئة كل الحقول الأساسية في النموذج
        document.getElementById('employee-modal-title').textContent = 'تعديل بيانات الموظف';
        document.getElementById('employee-id').value = employee.id;
        document.getElementById('employee-auth-id').value = employee.auth_user_id;
        document.getElementById('employee-creation-mode').value = 'update';
        document.getElementById('employee-name').value = employee.name || '';
        document.getElementById('employee-id-number').value = employee.id_number || '';
        document.getElementById('employee-phone').value = employee.phone || '';
        document.getElementById('employee-role').value = employee.role || 'حارس أمن';
        document.getElementById('employee-start-date').value = employee.start_of_work_date;
        document.getElementById('employee-password').value = '';
        document.getElementById('employee-password').placeholder = 'اتركه فارغاً لعدم التغيير';
        document.getElementById('employee-iban').value = employee.iban || '';
        document.getElementById('employee-bank-name').value = employee.bank_name || '';
        document.getElementById('employee-insurance').value = employee.insurance_status || 'غير مسجل';
        document.getElementById('employee-insurance-amount').value = employee.insurance_deduction_amount || 0;
        document.getElementById('employee-status').value = employee.employment_status || 'اساسي';
        document.getElementById('employee-id-number').disabled = true;
    
        // تعبئة بيانات التسكين الأولية
        document.getElementById('employee-project-display').value = employee.project || '';
        document.getElementById('employee-location-display').value = employee.location || '';
        document.getElementById('employee-region').value = employee.region || '';
        document.getElementById('employee-city').value = employee.city || '';
    
        const shiftDisplay = document.getElementById('employee-shift-display');
        const assignedVacancy = employee.job_vacancies;
        if (employee.employment_status === 'بديل راحة') {
            shiftDisplay.value = 'جدول ديناميكي (يغطي أيام الراحة)';
        } else if (assignedVacancy && assignedVacancy.schedule_details?.[0]) {
            const shift = assignedVacancy.schedule_details[0];
            shiftDisplay.value = `${shift.name || 'وردية'} (من ${formatTimeAMPM(shift.start_time)} إلى ${formatTimeAMPM(shift.end_time)})`;
        } else {
            shiftDisplay.value = 'لا توجد وردية محددة';
        }
    
        // إظهار وتعبئة حقول الصلاحيات بناءً على الدور
        const role = employee.role;
        const assignmentGroup = document.getElementById('manager-assignment-group');
        const regionGroup = document.getElementById('assign-region-group');
        const projectGroup = document.getElementById('assign-project-group');
        
        assignmentGroup.classList.add('hidden');
        regionGroup.classList.add('hidden');
        projectGroup.classList.add('hidden');
    
        if (role === 'ادارة العمليات') {
            assignmentGroup.classList.remove('hidden');
            regionGroup.classList.remove('hidden');
            document.getElementById('assign-region-select').value = employee.region || '';
        } else if (role === 'مشرف') {
            assignmentGroup.classList.remove('hidden');
            projectGroup.classList.remove('hidden');
            const projectSelect = document.getElementById('assign-project-select');
            projectSelect.innerHTML = '<option value="">جاري التحميل...</option>';
            const { data: contractsForSupervisor } = await supabaseClient.from('contracts').select('company_name');
            const projectNames = [...new Set(contractsForSupervisor.map(c => c.company_name))];
            projectSelect.innerHTML = '<option value="">-- اختر المشروع --</option>';
            projectSelect.innerHTML += projectNames.map(p => `<option value="${p}">${p}</option>`).join('');
            projectSelect.value = employee.project || '';
        }
    
        const vacancySelect = document.getElementById('employee-vacancy');
        const contractSelect = document.getElementById('employee-contract');
        vacancySelect.innerHTML = '<option value="">جاري التحميل...</option>';
        contractSelect.innerHTML = '<option value="">جاري التحميل...</option>';
    
        const { data: openVacancies } = await supabaseClient.from('job_vacancies').select('id, project, specific_location').eq('status', 'open');
        let allRelevantVacancies = openVacancies || [];
        if (assignedVacancy && !allRelevantVacancies.some(v => v.id === assignedVacancy.id)) {
            allRelevantVacancies.push(assignedVacancy);
        }
        
        const { data: contracts } = await supabaseClient.from('contracts').select('id, company_name').eq('status', 'active');
    
        contractSelect.innerHTML = '<option value="">غير تابع لعقد</option>';
        if (contracts) contractSelect.innerHTML += contracts.map(c => `<option value="${c.id}">${c.company_name}</option>`).join('');
        contractSelect.value = employee.contract_id || '';
    
        vacancySelect.innerHTML = '<option value="">غير مرتبط بشاغر</option>';
        if (allRelevantVacancies.length > 0) {
            vacancySelect.innerHTML += allRelevantVacancies.map(v => `<option value="${v.id}">${v.project} - ${v.specific_location || 'موقع عام'}</option>`).join('');
        }
        vacancySelect.value = employee.vacancy_id || '';
        
        modal.classList.remove('hidden');
    }

// نهاية الاستبدال
// نهاية الإضافة

    // --- منطق عرض تفاصيل الشاغر لمدير العمليات ---
if (event.target.closest('.view-vacancy-details-btn')) {
    const vacancyId = event.target.closest('.view-vacancy-details-btn').dataset.id;
    const { data: vacancy, error } = await supabaseClient.from('job_vacancies').select('*').eq('id', vacancyId).single();
    if (error) return alert('خطأ في جلب تفاصيل الشاغر.');

    const detailsBody = document.getElementById('vacancy-details-body');
    const totalSalary = (vacancy.base_salary || 0) + (vacancy.housing_allowance || 0) + (vacancy.transport_allowance || 0) + (vacancy.other_allowances || 0);

    detailsBody.innerHTML = `
        <div class="contract-display">
            <p><strong>المسمى الوظيفي:</strong> ${vacancy.title}</p>
            <p><strong>المشروع:</strong> ${vacancy.project}</p>
            <p><strong>الموقع المحدد:</strong> ${vacancy.specific_location || 'غير محدد'}</p>
            <p><strong>المدينة:</strong> ${vacancy.location}</p>
            <p><strong>المنطقة:</strong> ${vacancy.region}</p>
            <hr>
            <p><strong>الراتب الأساسي:</strong> ${vacancy.base_salary.toLocaleString('ar-SA')} ر.س</p>
            <p><strong>البدلات:</strong> ${(totalSalary - vacancy.base_salary).toLocaleString('ar-SA')} ر.س</p>
            <p><strong>إجمالي الراتب:</strong> ${totalSalary.toLocaleString('ar-SA')} ر.س</p>
        </div>
    `;
    document.getElementById('view-vacancy-details-modal').classList.remove('hidden');
}

    // --- بداية الإضافة: منطق حذف الموظف ---
    const deleteEmployeeBtn = event.target.closest('.delete-employee-btn');
    if (deleteEmployeeBtn) {
        const userId = deleteEmployeeBtn.dataset.id;
        const authUserId = deleteEmployeeBtn.dataset.authId;

        if (confirm('هل أنت متأكد من حذف هذا الموظف بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.')) {
            // تعطيل الزر لمنع الضغطات المتكررة
            deleteEmployeeBtn.disabled = true;
            deleteEmployeeBtn.innerHTML = '<i class="ph-fill ph-spinner-gap animate-spin"></i>';

            try {
                // استدعاء دالة الخادم التي أنشأناها
                const { data, error } = await supabaseClient.functions.invoke('delete-employee', {
                    body: { 
                        user_id: userId,
                        auth_user_id: authUserId
                    },
                });

                if (error || data.error) {
                    throw new Error(error?.message || data.error);
                }

                alert('تم حذف الموظف بنجاح!');
                // إعادة تحميل قائمة الموظفين وقائمة الشواغر لتحديث العدادات
                loadEmployeeTabData();
                loadVacancyTabData(); 

            } catch (err) {
                alert(`حدث خطأ أثناء حذف الموظف: ${err.message}`);
                console.error("Delete employee error:", err);
                // إعادة تفعيل الزر في حالة الخطأ
                deleteEmployeeBtn.disabled = false;
                deleteEmployeeBtn.innerHTML = '<i class="ph-bold ph-trash"></i> حذف';
            }
        }
    }
    // --- نهاية الإضافة ---


    // عند الضغط على "حذف شاغر"
    if (event.target.closest('.delete-vacancy-btn')) {
        const vacancyId = event.target.closest('.delete-vacancy-btn').dataset.id;
        if (confirm('هل أنت متأكد من رغبتك في حذف هذا الشاغر؟')) {
            const { error } = await supabaseClient.from('job_vacancies').delete().eq('id', vacancyId);
            if (error) {
                alert('حدث خطأ أثناء حذف الشاغر.');
            } else {
                 // --- تصحيح: تم استدعاء الدالة الصحيحة لتحديث القائمة
                loadVacancyTabData();
            }
        }
    }

// (منطق التعديل والحذف سيتم إضافته لاحقاً بنفس الطريقة)

// نهاية الإضافة
    // بداية الإضافة: منطق الأزرار الديناميكية لنافذة العقود

// عند الضغط على "إضافة موقع"
if (event.target.closest('#add-location-btn')) {
    const container = document.getElementById('locations-container');
    container.insertAdjacentHTML('beforeend', createLocationGroupHtml());
}

// عند الضغط على "حذف موقع"
if (event.target.closest('.delete-location-btn')) {
    event.target.closest('.location-group').remove();
}

// عند الضغط على "إضافة وردية أخرى لهذا الموقع"
if (event.target.closest('.add-shift-btn')) {
    const shiftsContainer = event.target.closest('.shifts-section').querySelector('.shifts-container');
    shiftsContainer.insertAdjacentHTML('beforeend', createShiftGroupHtml());
}

// عند الضغط على زر "حذف وردية"
if (event.target.closest('.delete-shift-btn')) {
    event.target.closest('.shift-group').remove();
}

// بداية الإضافة: منطق تعديل وحذف العقد



// عند الضغط على زر "حذف العقد"
if (event.target.closest('.delete-contract-btn')) {
    const contractId = event.target.closest('.delete-contract-btn').dataset.id;
    if (confirm('هل أنت متأكد من رغبتك في حذف هذا العقد؟ سيتم حذف كل ما يتعلق به.')) {
        const { error } = await supabaseClient.from('contracts').delete().eq('id', contractId);
        if (error) {
            alert('حدث خطأ أثناء حذف العقد.');
            console.error("Delete contract error:", error);
        } else {
            alert('تم حذف العقد بنجاح.');
            fetchContracts(); // إعادة تحميل القائمة
        }
    }
}

// نهاية الإضافة

// نهاية الإضافة



// بداية الاستبدال
// --- منطق متطور لمعالجة طلبات الموارد البشرية (توظيف وغيره) ---

// 1. منطق الموافقة على طلب توظيف (الأكثر تعقيداً)
const approveHiringBtn = event.target.closest('.approve-request-btn[data-type="hiring"]');
if (approveHiringBtn) {
    const requestId = approveHiringBtn.dataset.requestId;
    if (!requestId) return;

    if (confirm('هل أنت متأكد من الموافقة؟ سيتم إنشاء حساب للموظف وإغلاق الشاغر المرتبط به.')) {
        approveHiringBtn.disabled = true;
        approveHiringBtn.innerHTML = '<i class="ph-fill ph-spinner-gap animate-spin"></i>';

        try {
            // الخطوة أ: جلب بيانات الطلب كاملة
            const { data: request, error: requestError } = await supabaseClient
                .from('employee_requests')
                .select('details')
                .eq('id', requestId)
                .single();
            
            if (requestError) throw new Error(`لم يتم العثور على الطلب: ${requestError.message}`);
            
            const employeeDetails = request.details;
            const vacancyId = employeeDetails.vacancy_id;

            if (!employeeDetails.password || employeeDetails.password.length < 6) {
                throw new Error('لا يمكن الموافقة على الطلب. لم يتم تحديد كلمة مرور للموظف أو أنها قصيرة جداً.');
            }

            // الخطوة ب: استدعاء دالة إنشاء الموظف
            const { password, ...profileData } = employeeDetails;
            const { data: functionResponse, error: functionError } = await supabaseClient.functions.invoke('create-employee', {
                body: { password, ...profileData }
            });

            if (functionError) throw new Error(`فشل في إنشاء الموظف: ${functionError.message}`);
            if (functionResponse.error) throw new Error(`خطأ من الخادم: ${functionResponse.error}`);

            // الخطوة ج: إذا نجح إنشاء الموظف، نُغلق الشاغر
            if (vacancyId) {
                const { error: vacancyError } = await supabaseClient
                    .from('job_vacancies')
                    .update({ status: 'closed' }) // <--- هنا يتم إغلاق الشاغر
                    .eq('id', vacancyId);
                
                if (vacancyError) {
                    console.warn(`تم إنشاء الموظف ولكن فشل إغلاق الشاغر ${vacancyId}:`, vacancyError);
                }
            }

            // الخطوة د: تحديث حالة الطلب الأصلي إلى "مقبول"
            const { error: updateRequestError } = await supabaseClient
                .from('employee_requests')
                .update({ status: 'مقبول' })
                .eq('id', requestId);
            
            if (updateRequestError) throw new Error(`فشل تحديث حالة الطلب: ${updateRequestError.message}`);

            alert('تمت الموافقة على الطلب وإنشاء الموظف بنجاح!');
            if (typeof loadOperationsRequestsPage === 'function') loadOperationsRequestsPage();
            if (typeof loadVacancyTabData === 'function') loadVacancyTabData();


        } catch (error) {
            alert(`حدث خطأ: ${error.message}`);
            console.error("Hiring Approval Error:", error);
            approveHiringBtn.disabled = false;
            approveHiringBtn.innerHTML = '<i class="ph-bold ph-check"></i> قبول';
        }
    }
}

// 2. منطق رفض طلب توظيف
const rejectHiringBtn = event.target.closest('.reject-request-btn[data-type="hiring"]');
if (rejectHiringBtn) {
    const requestId = rejectHiringBtn.dataset.requestId;
    if (!requestId) return;

    const reason = prompt('الرجاء إدخال سبب الرفض:');
    if (reason && reason.trim() !== '') {
        rejectHiringBtn.disabled = true;
        rejectHiringBtn.innerHTML = '<i class="ph-fill ph-spinner-gap animate-spin"></i>';

        const { error } = await supabaseClient
            .from('employee_requests')
            .update({ status: 'مرفوض', rejection_reason: reason })
            .eq('id', requestId);

        if (error) {
            alert('حدث خطأ أثناء رفض الطلب.');
            rejectHiringBtn.disabled = false;
            rejectHiringBtn.innerHTML = '<i class="ph-bold ph-x"></i> رفض';
        } else {
            alert('تم رفض طلب التوظيف.');
            if (typeof loadOperationsRequestsPage === 'function') loadOperationsRequestsPage();
        }
    }
}


// نهاية الاستبدال

    /// ================================================================
// ===   منطق فتح نوافذ إضافة الموظفين وتعيين وضع الإنشاء   ===
// ================================================================

// --- عند الضغط على "إضافة موظف جديد" (من صفحة الموارد البشرية) ---
if (event.target.closest('#add-employee-btn')) {
    const modal = document.getElementById('employee-modal');
    
    // إعادة تعيين الفورم بالكامل
    modal.querySelector('.modal-body').querySelectorAll('input, select, textarea').forEach(el => {
        if (el.type === 'select-one') el.selectedIndex = 0;
        else el.value = '';
    });
    document.getElementById('employee-modal-title').textContent = 'إضافة موظف جديد';
    document.getElementById('employee-creation-mode').value = 'direct'; // الوضع: إنشاء مباشر
    document.getElementById('employee-id-number').disabled = false;

    // جلب العقود والشواغر
    const contractSelect = document.getElementById('employee-contract');
    const vacancySelect = document.getElementById('employee-vacancy');
    contractSelect.innerHTML = '<option value="">جاري التحميل...</option>';
    vacancySelect.innerHTML = '<option value="">جاري التحميل...</option>';

    const [{ data: contracts }, { data: vacancies }] = await Promise.all([
        supabaseClient.from('contracts').select('id, company_name').eq('status', 'active'),
        supabaseClient.from('job_vacancies').select('id, project, specific_location').eq('status', 'open')
    ]);

    contractSelect.innerHTML = '<option value="">غير تابع لعقد</option>';
    if (contracts) contractSelect.innerHTML += contracts.map(c => `<option value="${c.id}">${c.company_name}</option>`).join('');
    
    vacancySelect.innerHTML = '<option value="">غير مرتبط بشاغر</option>';
    if (vacancies) {
        const vacancyOptions = vacancies.map(v => `<option value="${v.id}">${v.project} - ${v.specific_location || 'موقع عام'}</option>`).join('');
        vacancySelect.innerHTML += vacancyOptions;
    }

    modal.classList.remove('hidden');
}

// بداية الاستبدال
// --- عند الضغط على "توظيف جديد" (من صفحة العمليات) ---
if (event.target.closest('.hire-new-btn')) {
    const hireNewBtn = event.target.closest('.hire-new-btn');
    const modal = document.getElementById('employee-modal');
    
    // إعادة تعيين الفورم بالكامل
    modal.querySelector('.modal-body').querySelectorAll('input, select, textarea').forEach(el => { el.value = ''; });
    document.getElementById('employee-modal-title').textContent = 'طلب توظيف جديد';
    document.getElementById('employee-creation-mode').value = 'request';
    document.getElementById('employee-id-number').disabled = false;

    // جلب البيانات من الزر الذي تم الضغط عليه
    const vacancyId = hireNewBtn.dataset.vacancyId;
    const contractId = hireNewBtn.dataset.contractId;
    const project = hireNewBtn.dataset.project;
    const role = hireNewBtn.dataset.role;

    // تعبئة الحقول المخفية والظاهرة
    document.getElementById('employee-role').value = role;
    document.getElementById('employee-vacancy-id').value = vacancyId;
    document.getElementById('employee-project-hidden').value = project;
    
    // جلب وتعبئة قوائم العقود والشواغر
    const contractSelect = document.getElementById('employee-contract');
    const vacancySelect = document.getElementById('employee-vacancy');
    contractSelect.innerHTML = '<option value="">جاري التحميل...</option>';
    vacancySelect.innerHTML = '<option value="">جاري التحميل...</option>';
    modal.classList.remove('hidden'); // إظهار النافذة بسرعة

    const [{ data: contracts }, { data: vacancies }] = await Promise.all([
        supabaseClient.from('contracts').select('id, company_name').eq('status', 'active'),
        supabaseClient.from('job_vacancies').select('id, project, specific_location').eq('status', 'open')
    ]);

    // تعبئة قائمة العقود
    contractSelect.innerHTML = '<option value="">غير تابع لعقد</option>';
    if (contracts) contractSelect.innerHTML += contracts.map(c => `<option value="${c.id}">${c.company_name}</option>`).join('');
    
    // تعبئة قائمة الشواغر
    vacancySelect.innerHTML = '<option value="">غير مرتبط بشاغر</option>';
    if (vacancies) {
        vacancySelect.innerHTML += vacancies.map(v => `<option value="${v.id}">${v.project} - ${v.specific_location || 'موقع عام'}</option>`).join('');
    }
    
    // **الخطوة الأهم: تحديد العقد والشاغر تلقائياً**
    if (contractId) contractSelect.value = contractId;
    if (vacancyId) vacancySelect.value = vacancyId;
}
// نهاية الاستبدال
// --- عند الضغط على زر "تعديل الموظف" (النسخة النهائية والمحصّنة ضد النقرات المزدوجة) ---
if (event.target.closest('.edit-employee-btn')) {
    const editBtn = event.target.closest('.edit-employee-btn');
    const userId = editBtn.dataset.id;

    // --- الخطوة 1: التحقق من أن الزر غير معطل بالفعل ---
    if (!userId || editBtn.disabled) return;

    // --- الخطوة 2: تعطيل الزر فوراً وإظهار مؤشر التحميل ---
    const originalBtnContent = editBtn.innerHTML;
    editBtn.disabled = true;
    editBtn.innerHTML = '<i class="ph-fill ph-spinner-gap animate-spin"></i>';

    try {
        // جلب بيانات الموظف الأساسية
        const { data: employee, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !employee) {
            throw new Error('لم يتم العثور على بيانات الموظف أو حدث خطأ.');
        }

        const modal = document.getElementById('employee-modal');
        
        // تعبئة الحقول العامة
        document.getElementById('employee-modal-title').textContent = 'تعديل بيانات الموظف';
        document.getElementById('employee-id').value = employee.id;
        document.getElementById('employee-auth-id').value = employee.auth_user_id;
        document.getElementById('employee-creation-mode').value = 'update';
        document.getElementById('employee-name').value = employee.name || '';
        document.getElementById('employee-id-number').value = employee.id_number || '';
        document.getElementById('employee-phone').value = employee.phone || '';
        document.getElementById('employee-role').value = employee.role || 'حارس أمن';
        document.getElementById('employee-start-date').value = employee.start_of_work_date;
        document.getElementById('employee-password').value = '';
        document.getElementById('employee-password').placeholder = 'اتركه فارغاً لعدم التغيير';
        document.getElementById('employee-iban').value = employee.iban || '';
        document.getElementById('employee-bank-name').value = employee.bank_name || '';
        document.getElementById('employee-insurance').value = employee.insurance_status || 'غير مسجل';
        document.getElementById('employee-insurance-amount').value = employee.insurance_deduction_amount || 0;
        document.getElementById('employee-status').value = employee.employment_status || 'اساسي';
        document.getElementById('employee-id-number').disabled = true;

        // التعامل مع الحقول المعتمدة على الدور
        const isSecurityGuard = employee.role === 'حارس أمن';
        const vacancyAndContractFields = [
            document.getElementById('employee-vacancy').parentElement,
            document.getElementById('employee-contract').parentElement,
            document.getElementById('employee-shift-display').parentElement
        ];

        if (isSecurityGuard) {
            vacancyAndContractFields.forEach(el => el.classList.remove('hidden'));
            const vacancySelect = document.getElementById('employee-vacancy');
            const contractSelect = document.getElementById('employee-contract');
            const shiftDisplay = document.getElementById('employee-shift-display');

            const { data: openVacanciesData } = await supabaseClient.from('job_vacancies').select('id, project, specific_location').eq('status', 'open');
            const { data: contractsData } = await supabaseClient.from('contracts').select('id, company_name');
            const openVacancies = openVacanciesData || [];
            const contracts = contractsData || [];
            let allRelevantVacancies = [...openVacancies];
            
            if (employee.vacancy_id) {
                const { data: assignedVacancy } = await supabaseClient.from('job_vacancies').select('*').eq('id', employee.vacancy_id).single();
                if (assignedVacancy) {
                    if (!allRelevantVacancies.some(v => v.id === assignedVacancy.id)) {
                        allRelevantVacancies.push(assignedVacancy);
                    }
                    if (assignedVacancy.schedule_details?.[0]) {
                        const shift = assignedVacancy.schedule_details[0];
                        shiftDisplay.value = `${shift.name || 'وردية'} (من ${formatTimeAMPM(shift.start_time)} إلى ${formatTimeAMPM(shift.end_time)})`;
                    }
                }
            } else {
                 shiftDisplay.value = 'لا توجد وردية محددة';
            }
            
            contractSelect.innerHTML = '<option value="">غير تابع لعقد</option>' + contracts.map(c => `<option value="${c.id}">${c.company_name}</option>`).join('');
            vacancySelect.innerHTML = '<option value="">غير مرتبط بشاغر</option>' + allRelevantVacancies.map(v => `<option value="${v.id}">${v.project} - ${v.specific_location || 'موقع عام'}</option>`).join('');
            contractSelect.value = employee.contract_id || '';
            vacancySelect.value = employee.vacancy_id || '';
        } else {
            vacancyAndContractFields.forEach(el => el.classList.add('hidden'));
        }

        // التعامل مع صلاحيات المدراء
        const assignmentGroup = document.getElementById('manager-assignment-group');
        const regionGroup = document.getElementById('assign-region-group');
        const projectGroup = document.getElementById('assign-project-group');
        [assignmentGroup, regionGroup, projectGroup].forEach(el => el.classList.add('hidden'));

        if (employee.role === 'ادارة العمليات') {
            [assignmentGroup, regionGroup].forEach(el => el.classList.remove('hidden'));
            document.getElementById('assign-region-select').value = employee.region || '';
        } else if (employee.role === 'مشرف') {
            [assignmentGroup, projectGroup].forEach(el => el.classList.remove('hidden'));
            const projectContainer = document.getElementById('assign-project-checkbox-container');
            const { data: contractsForSupervisorData } = await supabaseClient.from('contracts').select('company_name');
            const contractsForSupervisor = contractsForSupervisorData || [];
            const projectNames = [...new Set(contractsForSupervisor.map(c => c.company_name))];
            const supervisorProjects = Array.isArray(employee.project) ? employee.project : [];
            projectContainer.innerHTML = `<div class="checkbox-grid">${projectNames.map(p => `<label><input type="checkbox" value="${p}" ${supervisorProjects.includes(p) ? 'checked' : ''}> ${p}</label>`).join('')}</div>`;
        }
        
        modal.classList.remove('hidden');

    } catch (err) {
        console.error('Employee fetch error:', err);
        alert('حدث خطأ في جلب بيانات الموظف: ' + err.message);
    } finally {
        // --- الخطوة 3: إعادة تفعيل الزر وإرجاع محتواه الأصلي في كل الحالات ---
        editBtn.disabled = false;
        editBtn.innerHTML = originalBtnContent;
    }
}
// بداية الاستبدال
// --- عند الضغط على زر "حفظ الموظف" (النسخة النهائية مع هيكل بيانات موحد) ---
if (event.target.closest('#save-employee-btn')) {
    const saveBtn = event.target.closest('#save-employee-btn');
    const creationMode = document.getElementById('employee-creation-mode').value;
    const employeeId = document.getElementById('employee-id').value;
    const authId = document.getElementById('employee-auth-id').value;

    saveBtn.disabled = true;
    saveBtn.textContent = 'جاري الحفظ...';

    try {
        const role = document.getElementById('employee-role').value;
        const assignedShiftElement = document.getElementById('employee-shift');
        const assignedShift = (assignedShiftElement && assignedShiftElement.value) ? JSON.parse(assignedShiftElement.value) : null;
        
        let profileData = {
            name: document.getElementById('employee-name').value,
            start_of_work_date: document.getElementById('employee-start-date').value || null,
            phone: document.getElementById('employee-phone').value,
            iban: document.getElementById('employee-iban').value,
            role: role,
            employment_status: document.getElementById('employee-status').value,
            insurance_status: document.getElementById('employee-insurance').value,
            insurance_deduction_amount: parseFloat(document.getElementById('employee-insurance-amount').value) || 0,
            bank_name: document.getElementById('employee-bank-name').value,
            project: null,
            location: null,
            city: null,
            region: null,
            vacancy_id: null,
            contract_id: null,
            assigned_shift: null
        };

        if (role === 'ادارة العمليات') {
            profileData.region = document.getElementById('assign-region-select').value;
        } else if (role === 'مشرف') {
            // --- هنا تم التصحيح الرئيسي لمنطق الحفظ ---
            const projectContainer = document.getElementById('assign-project-checkbox-container');
            if (projectContainer) {
                const selectedProjects = Array.from(projectContainer.querySelectorAll('input[type="checkbox"]:checked'))
                                              .map(checkbox => checkbox.value);
                profileData.project = selectedProjects;
            } else {
                profileData.project = []; // في حال عدم وجود الحاوية، نرسل مصفوفة فارغة
            }
        } else if (role === 'حارس أمن') {
            profileData.vacancy_id = document.getElementById('employee-vacancy').value || null;
            profileData.contract_id = document.getElementById('employee-contract').value || null;
            profileData.assigned_shift = assignedShift;
            const singleProject = document.getElementById('employee-project-display').value;
            profileData.project = singleProject ? [singleProject] : [];
            profileData.location = document.getElementById('employee-location-display').value;
            profileData.city = document.getElementById('employee-city').value;
            profileData.region = document.getElementById('employee-region').value;
        }
        
        if (profileData.employment_status === 'بديل راحة') {
            profileData.assigned_shift = null;
        }

        if (!profileData.name || !profileData.role) throw new Error('الرجاء تعبئة حقول الاسم والدور.');
        
        if (creationMode === 'update') {
            const newPassword = document.getElementById('employee-password').value;
            if (newPassword && newPassword.trim() !== '') {
                if (newPassword.length < 6) throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
                if (!authId) throw new Error('لا يمكن تحديث كلمة المرور. معرّف المصادقة الخاص بالموظف مفقود.');
                
                const { data, error: passwordError } = await supabaseClient.functions.invoke('update-employee-password', {
                    body: { auth_id: authId, new_password: newPassword }
                });
                if (passwordError || (data && data.error)) throw new Error(passwordError?.message || data.error || 'فشل تحديث كلمة المرور.');
            }

            const { error: updateError } = await supabaseClient.from('users').update(profileData).eq('id', employeeId);
            if (updateError) throw updateError;

            if (profileData.vacancy_id && profileData.employment_status !== 'اجازة') {
                await supabaseClient.from('job_vacancies').update({ status: 'closed' }).eq('id', profileData.vacancy_id);
            }
            
            alert('تم تحديث بيانات الموظف بنجاح.');

        } else { 
            const fullProfileData = { ...profileData, id_number: document.getElementById('employee-id-number').value };
            const newPassword = document.getElementById('employee-password').value;
            if (!fullProfileData.id_number || !newPassword || newPassword.length < 6) throw new Error('يجب إدخال رقم هوية وكلمة مرور (6 أحرف على الأقل) للموظف الجديد.');
            
            const { data, error } = await supabaseClient.functions.invoke('create-employee', { body: { password: newPassword, ...fullProfileData } });
            
            if (error) throw error;
            if (data.error) throw new Error(data.error);
            
            if (profileData.vacancy_id) await supabaseClient.from('job_vacancies').update({ status: 'closed' }).eq('id', profileData.vacancy_id);
            alert('تم إنشاء الموظف بنجاح.');
        }

        document.getElementById('employee-modal').classList.add('hidden');
        if (typeof loadEmployeeTabData === 'function') loadEmployeeTabData();
        if (typeof loadVacancyTabData === 'function') loadVacancyTabData();

    } catch (error) {
        alert(`حدث خطأ: ${error.message}`);
        console.error("Save/Update Employee Error:", error);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'حفظ الموظف';
        document.getElementById('employee-id-number').disabled = false;
    }
}
// نهاية الاستبدال
// ================================================================
    // ===                    منطق إدارة العقود (نسخة مطورة)                    ===
    // ================================================================
// --- منطق تبويبات صفحة الموارد البشرية ---
    if (event.target.closest('.tab-link')) {
        event.preventDefault();
        const tabLink = event.target.closest('.tab-link');
        const targetTabId = tabLink.dataset.tab;

        // إزالة active من كل التبويبات والمحتوى
        tabLink.parentElement.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        // إضافة active للتبويب والمحتوى المستهدف
        tabLink.classList.add('active');
        document.getElementById(targetTabId).classList.add('active');

        // تحميل بيانات التبويب المطلوب
        if (targetTabId === 'hr-tab-vacancies') loadVacancyTabData();
        if (targetTabId === 'hr-tab-employees') loadEmployeeTabData();
    }


    
    // --- دوال مساعدة لنظام البنود الديناميكي ---

    // دالة لإنشاء HTML الخاص ببند واحد
    function createClauseItemHtml(clauseText = '') {
        return `
            <div class="clause-item">
                <input type="text" class="clause-item-input" placeholder="اكتب نص البند هنا..." value="${clauseText}">
                <button class="delete-btn delete-clause-item-btn" title="حذف البند"><i class="ph-bold ph-trash"></i></button>
            </div>
        `;
    }

    // دالة لإنشاء HTML الخاص بمجموعة بنود كاملة
    function createClauseGroupHtml(group = { title: '', clauses: [''] }) {
        const groupId = `group_${Date.now()}_${Math.random()}`;
        const clausesHtml = group.clauses.map(clause => createClauseItemHtml(clause)).join('');

        return `
            <div class="clause-group" id="${groupId}">
                <div class="clause-group-header">
                    <div class="form-group">
                        <label>عنوان المجموعة</label>
                        <input type="text" class="clause-group-title" placeholder="مثال: التزامات الطرف الأول" value="${group.title}">
                    </div>
                    <button class="delete-btn delete-clause-group-btn" title="حذف المجموعة كاملة"><i class="ph-bold ph-x-circle"></i></button>
                </div>
                <div class="clause-items-list">
                    ${clausesHtml}
                </div>
                <div class="clause-group-footer">
                    <button class="btn btn-secondary add-clause-item-btn"><i class="ph-bold ph-plus"></i> إضافة بند لهذه المجموعة</button>
                </div>
            </div>
        `;
    }

    // --- معالجات الأحداث (Event Handlers) ---

    // عند الضغط على "إضافة عقد جديد"
    // ================================================================
// ===                    منطق إدارة العقود (نسخة مطورة)                    ===
// ================================================================

// --- الأزرار الرئيسية لفتح النوافذ ---












    // --- الأزرار الديناميكية داخل نافذة العقود ---

    // عند الضغط على "إضافة مجموعة"
    if (event.target.closest('#add-clause-group-btn')) {
        document.getElementById('clause-groups-container').insertAdjacentHTML('beforeend', createClauseGroupHtml());
    }

    // عند الضغط على "إضافة بند لهذه المجموعة"
    if (event.target.closest('.add-clause-item-btn')) {
        const list = event.target.closest('.clause-group').querySelector('.clause-items-list');
        list.insertAdjacentHTML('beforeend', createClauseItemHtml());
    }

    // عند الضغط على "حذف مجموعة"
    if (event.target.closest('.delete-clause-group-btn')) {
        event.target.closest('.clause-group').remove();
    }
    
    // عند الضغط على "حذف بند"
    if (event.target.closest('.delete-clause-item-btn')) {
        event.target.closest('.clause-item').remove();
    }
    
// ================================================================
// ===                 منطق إدارة الموارد البشرية (الشواغر)                 ===
// ================================================================

// عند الضغط على زر "إضافة شاغر جديد"
if (event.target.closest('#add-vacancy-btn')) {
    const modal = document.getElementById('vacancy-modal');
    // إعادة تعيين الفورم
    document.getElementById('vacancy-modal-title').textContent = 'إضافة شاغر جديد';
    document.getElementById('vacancy-id').value = '';
    modal.querySelector('form')?.reset(); // طريقة أسهل لإعادة تعيين النموذج

    // جلب العقود النشطة لملء القائمة
    const contractSelect = document.getElementById('vacancy-contract');
    contractSelect.innerHTML = '<option value="">جاري تحميل العقود...</option>';
    const { data: contracts } = await supabaseClient.from('contracts').select('id, company_name').eq('status', 'active');
    if (contracts) {
        contractSelect.innerHTML = '<option value="">بدون عقد محدد</option>';
        contractSelect.innerHTML += contracts.map(c => `<option value="${c.id}">${c.company_name}</option>`).join('');
    }
    
    modal.classList.remove('hidden');
}

// --- عند الضغط على زر "تعديل شاغر" (النسخة النهائية والمصححة) ---
if (event.target.closest('.edit-vacancy-btn')) {
    const vacancyId = event.target.closest('.edit-vacancy-btn').dataset.id;
    // جلب الشاغر مع بيانات العقد المرتبط به
    const { data: vacancy, error } = await supabaseClient
        .from('job_vacancies')
        .select('*, contracts(*)')
        .eq('id', vacancyId)
        .single();

    if (error || !vacancy) {
        return alert('خطأ في جلب بيانات الشاغر للتعديل.');
    }

    const modal = document.getElementById('vacancy-modal');

    // --- 1. تعبئة المعلومات الأساسية ---
    document.getElementById('vacancy-modal-title').textContent = 'تعديل شاغر وظيفي';
    document.getElementById('vacancy-id').value = vacancy.id;
    document.getElementById('vacancy-title').value = vacancy.title;
    document.getElementById('vacancy-project').value = vacancy.project;
    document.getElementById('vacancy-city').value = vacancy.location; // "location" هو حقل المدينة
    document.getElementById('vacancy-status').value = vacancy.status;

    // --- 2. تعبئة تفاصيل الراتب ---
    document.getElementById('vacancy-base-salary').value = vacancy.base_salary;
    document.getElementById('vacancy-housing').value = vacancy.housing_allowance;
    document.getElementById('vacancy-transport').value = vacancy.transport_allowance;
    document.getElementById('vacancy-other').value = vacancy.other_allowances;

    // --- 3. التعامل مع القوائم المنسدلة (العقد، الموقع، الوردية) ---
    const contractSelect = document.getElementById('vacancy-contract');
    const locationGroup = document.getElementById('vacancy-location-group');
    const locationSelect = document.getElementById('vacancy-location-select');
    const shiftGroup = document.getElementById('vacancy-shift-group');
    const shiftSelect = document.getElementById('vacancy-shift-select');

    // جلب كل العقود لملء القائمة
    const { data: contracts } = await supabaseClient.from('contracts').select('id, company_name, contract_locations');
    contractSelect.innerHTML = '<option value="">-- اختر عقداً --</option>';
    if (contracts) {
        contractSelect.innerHTML += contracts.map(c => `<option value="${c.id}">${c.company_name}</option>`).join('');
    }
    contractSelect.value = vacancy.contract_id; // تحديد العقد الحالي للشاغر

    // إظهار وتعبئة قائمة المواقع بناءً على العقد المحدد
    const selectedContractData = contracts.find(c => c.id === vacancy.contract_id);
    if (selectedContractData && selectedContractData.contract_locations) {
        locationSelect.innerHTML = '<option value="">-- اختر موقعاً --</option>';
        selectedContractData.contract_locations.forEach(loc => {
            locationSelect.innerHTML += `<option value="${loc.name}">${loc.name}</option>`;
        });
        locationSelect.value = vacancy.specific_location;
        locationGroup.classList.remove('hidden');
    }

    // إظهار وتعبئة قائمة الورديات بناءً على الموقع المحدد
    if (vacancy.specific_location && selectedContractData && selectedContractData.contract_locations) {
        const selectedLocationData = selectedContractData.contract_locations.find(l => l.name === vacancy.specific_location);
        if (selectedLocationData && selectedLocationData.shifts) {
            shiftSelect.innerHTML = '<option value="">-- اختر وردية --</option>';
            selectedLocationData.shifts.forEach(shift => {
                const shiftLabel = `${shift.name || 'وردية'} (من ${shift.start_time || '?'} إلى ${shift.end_time || '?'})`;
                shiftSelect.innerHTML += `<option value='${JSON.stringify(shift)}'>${shiftLabel}</option>`;
            });
            // تحديد الوردية الحالية للشاغر
            if (vacancy.schedule_details && vacancy.schedule_details[0]) {
                shiftSelect.value = JSON.stringify(vacancy.schedule_details[0]);
            }
            shiftGroup.classList.remove('hidden');
        }
    }

    modal.classList.remove('hidden');
}

// بداية الاستبدال
// بداية الاستبدال

if (event.target.closest('#save-vacancy-btn')) {
    const saveBtn = event.target.closest('#save-vacancy-btn');
    const id = document.getElementById('vacancy-id').value;
    saveBtn.disabled = true;
    saveBtn.textContent = 'جاري الحفظ...';

    try {
        const selectedShiftElement = document.getElementById('vacancy-shift-select');
        const shiftDetails = selectedShiftElement.value ? JSON.parse(selectedShiftElement.value) : null;
        
        if (!shiftDetails) {
            throw new Error('الرجاء اختيار وردية للشاغر.');
        }

        const contractId = document.getElementById('vacancy-contract').value;
        let contractRegion = ''; 
        if (contractId) {
            const { data: contract } = await supabaseClient.from('contracts').select('region').eq('id', contractId).single();
            // --- بداية الجزء المصحح ---
            // تعامل مع المنطقة كنص واحد مباشرة
            if (contract) contractRegion = contract.region || '';
            // --- نهاية الجزء المصحح ---
        }

        const vacancyData = {
            title: document.getElementById('vacancy-title').value,
            contract_id: contractId || null,
            project: document.getElementById('vacancy-project').value,
            location: document.getElementById('vacancy-city').value,
            region: contractRegion, // استخدام المتغير النصي الصحيح
            specific_location: document.getElementById('vacancy-location-select').value,
            status: document.getElementById('vacancy-status').value,
            base_salary: parseFloat(document.getElementById('vacancy-base-salary').value) || 0,
            housing_allowance: parseFloat(document.getElementById('vacancy-housing').value) || 0,
            transport_allowance: parseFloat(document.getElementById('vacancy-transport').value) || 0,
            other_allowances: parseFloat(document.getElementById('vacancy-other').value) || 0,
            work_days_count: shiftDetails.days.length,
            work_hours: shiftDetails.work_hours,
            schedule_details: [shiftDetails]
        };

        if (!vacancyData.title || !vacancyData.project) throw new Error('الرجاء إدخال المسمى الوظيفي والمشروع.');
        
        const { data, error } = id
            ? await supabaseClient.from('job_vacancies').update(vacancyData).eq('id', id).select().single()
            : await supabaseClient.from('job_vacancies').insert([vacancyData]).select().single();
        
        if (error) throw error;
        
        alert('تم حفظ الشاغر بنجاح!');
        document.getElementById('vacancy-modal').classList.add('hidden');
        loadVacancyTabData();

    } catch (error) {
        alert('حدث خطأ أثناء حفظ الشاغر: ' + error.message);
        console.error(error);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'حفظ الشاغر';
    }
}

// نهاية الاستبدال
// نهاية الاستبدال

// عند الضغط على "حذف شاغر"
if (event.target.closest('.delete-vacancy-btn')) {
    const vacancyId = event.target.closest('.delete-vacancy-btn').dataset.id;
    if (confirm('هل أنت متأكد من رغبتك في حذف هذا الشاغر؟')) {
        const { error } = await supabaseClient.from('job_vacancies').delete().eq('id', vacancyId);
        if (error) {
            alert('حدث خطأ أثناء حذف الشاغر.');
        } else {
            // --- تصحيح: تم استدعاء الدالة الصحيحة "loadVacancyTabData"
            loadVacancyTabData();
        }
    }
}
// --- منطق تسجيل زيارة ميدانية ---
const addVisitBtn = event.target.closest('#add-visit-btn');
if (addVisitBtn) {
    const modal = document.getElementById('add-visit-modal');
    const clientSelect = document.getElementById('visit-client-select');
    const visitTimeInput = document.getElementById('visit-time-input');

    // إظهار النافذة وعرض رسالة تحميل مبدئية
    modal.classList.remove('hidden');
    clientSelect.innerHTML = '<option>جاري تحميل المواقع...</option>';
    
    // تعيين الوقت الحالي كوقت افتراضي للزيارة
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    visitTimeInput.value = now.toISOString().slice(0, 16);

    // جلب قائمة كل العملاء (المواقع)
    const { data: clients, error } = await supabaseClient.from('clients').select('id, name');

    if (error || !clients) {
        clientSelect.innerHTML = '<option>خطأ في تحميل المواقع</option>';
    } else {
        clientSelect.innerHTML = clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
}

// بداية الاستبدال
// منطق حفظ الزيارة (النسخة الجديدة)
const submitVisitBtn = event.target.closest('#submit-visit-btn');
if (submitVisitBtn) {
    const modal = document.getElementById('add-visit-modal');
    const locationName = document.getElementById('visit-client-select').value;
    const visitTime = document.getElementById('visit-time-input').value;
    const notes = document.getElementById('visit-notes-textarea').value;

    if (!locationName || !visitTime || !notes.trim()) {
        return alert('الرجاء تعبئة جميع الحقول.');
    }

    submitVisitBtn.disabled = true;
    submitVisitBtn.textContent = 'جاري الحفظ...';

    const { error } = await supabaseClient
        .from('visits')
        .insert({
            user_id: currentUser.id,
            contract_id: currentUser.contract_id, // من بيانات المشرف
            location_name: locationName, // من القائمة المنسدلة
            visit_time: visitTime,
            notes: notes
        });

    if (error) {
        alert('حدث خطأ أثناء حفظ الزيارة.');
        console.error('Visit Log Error:', error);
    } else {
        alert('تم تسجيل الزيارة بنجاح.');
        modal.classList.add('hidden');
        if (typeof fetchVisits === 'function') fetchVisits();
        if (typeof loadMyVisitsPage === 'function') loadMyVisitsPage();
    }

    submitVisitBtn.disabled = false;
    submitVisitBtn.textContent = 'حفظ الزيارة';
}
// نهاية الاستبدال
    // --- منطق طلب نقل حارس ---
 const requestTransferBtn = event.target.closest('#request-transfer-btn');
if (requestTransferBtn) {
    const modal = document.getElementById('guard-transfer-modal');
    const guardSelect = document.getElementById('transfer-guard-select');
    const clientSelect = document.getElementById('transfer-client-select');

    // إظهار النافذة وعرض رسالة تحميل مبدئية
    modal.classList.remove('hidden');
    guardSelect.innerHTML = '<option>جاري تحميل الحراس...</option>';
    clientSelect.innerHTML = '<option>جاري تحميل المواقع...</option>';

    // جلب قائمة الحراس التابعين للمشرف
    const { data: guards, error: guardsError } = await supabaseClient
        .from('users')
        .select('id, name')
        .eq('supervisor_id', currentUser.id);

    if (guardsError || !guards) {
        guardSelect.innerHTML = '<option>خطأ في تحميل الحراس</option>';
    } else {
        guardSelect.innerHTML = guards.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    }

    // جلب قائمة كل العملاء (المواقع)
    const { data: clients, error: clientsError } = await supabaseClient.from('clients').select('id, name');

    if (clientsError || !clients) {
        clientSelect.innerHTML = '<option>خطأ في تحميل المواقع</option>';
    } else {
        clientSelect.innerHTML = clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
}

// عند الضغط على زر "إرسال طلب النقل" داخل النافذة
const submitTransferBtn = event.target.closest('#submit-transfer-request-btn');
if (submitTransferBtn) {
    const modal = document.getElementById('guard-transfer-modal');
    const guardId = document.getElementById('transfer-guard-select').value;
    const clientId = document.getElementById('transfer-client-select').value;
    const reason = document.getElementById('transfer-reason').value;

    if (!guardId || !clientId || !reason.trim()) {
        alert('الرجاء تعبئة جميع الحقول.');
        return;
    }

    submitTransferBtn.disabled = true;
    submitTransferBtn.textContent = 'جاري الإرسال...';

    //  تصحيح: تم تغيير اسم العمود من user_id إلى supervisor_id ليطابق قاعدة البيانات
    const { error } = await supabaseClient
        .from('visits')
        .insert({
            supervisor_id: currentUser.id, // هذا هو الاسم الصحيح لعمود المشرف
            client_id: clientId,
            visit_time: visitTime,
            notes: notes
        });

    if (error) {
        alert('حدث خطأ أثناء إرسال الطلب.');
        console.error('Transfer Request Error:', error);
    } else {
        alert('تم إرسال طلب النقل بنجاح.');
        modal.classList.add('hidden');
    }

    submitTransferBtn.disabled = false;
    submitTransferBtn.textContent = 'إرسال طلب النقل';
}
    // --- A. Guard Request Cards Logic ---
    const requestCard = event.target.closest('.request-action-card');
    if (requestCard) {
        const requestType = requestCard.dataset.requestType;
        if (requestType) {
            const modalId = `${requestType}-request-modal`;
            const modal = document.getElementById(modalId);
            if (modal) modal.classList.remove('hidden');
        }
    }

    // ==================== بداية الإضافة ====================
// --- منطق بدء وإنهاء الجولة للمشرف ---
// بداية الاستبدال
// --- منطق بدء وإنهاء الجولة للمشرف (النسخة الجديدة) ---
const startPatrolBtn = event.target.closest('#start-patrol-btn');
// بداية الاستبدال
if (startPatrolBtn) {
    if (!confirm('هل أنت متأكد من رغبتك في بدء جولة ميدانية الآن؟')) return;

    startPatrolBtn.disabled = true;
    startPatrolBtn.innerHTML = '<i class="ph-fill ph-spinner-gap animate-spin"></i> جاري البدء...';

    const { data: newPatrol, error } = await supabaseClient
        .from('patrols')
        .insert({ supervisor_id: currentUser.id, status: 'active' })
        .select() // <-- طلب إعادة بيانات السجل الجديد
        .single();

    if (error || !newPatrol) {
        alert('حدث خطأ أثناء بدء الجولة.');
        console.error(error);
    } else {
        alert('تم بدء الجولة بنجاح! التتبع المباشر فعال الآن.');
        startPatrolTracking(newPatrol.id); // <-- تشغيل التتبع باستخدام معرف الجولة الجديدة
    }
    loadSupervisorPatrolPage();
    startPatrolBtn.disabled = false;
    startPatrolBtn.innerHTML = 'بدء الجولة';
}
// نهاية الاستبدال

// عند الضغط على "إنهاء الجولة" (يفتح النافذة فقط)
const endPatrolBtn = event.target.closest('#end-patrol-btn');
if (endPatrolBtn) {
    const patrolId = endPatrolBtn.dataset.patrolId;
    const modal = document.getElementById('end-patrol-modal');
    document.getElementById('active-patrol-id').value = patrolId;
    document.getElementById('patrol-notes').value = ''; // إفراغ الحقل
    modal.classList.remove('hidden');
}

// عند الضغط على "تأكيد وإنهاء الجولة" داخل النافذة
const confirmEndPatrolBtn = event.target.closest('#confirm-end-patrol-btn');
// بداية الاستبدال
if (confirmEndPatrolBtn) {
    const patrolId = document.getElementById('active-patrol-id').value;
    const notes = document.getElementById('patrol-notes').value;

    confirmEndPatrolBtn.disabled = true;
    confirmEndPatrolBtn.textContent = 'جاري الحفظ...';

    stopPatrolTracking(); // <-- إيقاف التتبع أولاً

    const { error } = await supabaseClient
        .from('patrols')
        .update({ end_time: new Date(), status: 'completed', notes: notes })
        .eq('id', patrolId);

    if (error) {
        alert('حدث خطأ أثناء إنهاء الجولة. قد تحتاج لبدء التتبع مرة أخرى.');
        console.error(error);
    } else {
        alert('تم إنهاء الجولة وحفظ المسار بنجاح.');
        document.getElementById('end-patrol-modal').classList.add('hidden');
    }
    loadSupervisorPatrolPage();
    confirmEndPatrolBtn.disabled = false;
    confirmEndPatrolBtn.textContent = 'تأكيد وإنهاء الجولة';
}
// نهاية الاستبدال
// نهاية الاستبدال
    // --- NEW: Attendance Check-in/Check-out Logic (نسخة مصححة) ---
    const checkInBtn = event.target.closest('#check-in-btn');
    const checkOutBtn = event.target.closest('#check-out-btn');



// عند الضغط على زر "تسجيل انصراف"
// ==================== بداية الاستبدال ====================
// عند الضغط على زر "تسجيل انصراف"
if (checkOutBtn) {
    if (confirm('هل أنت متأكد من أنك تريد تسجيل الانصراف الآن؟')) {

        // تعطيل الزر لمنع الضغطات المتكررة وعرض مؤشر التحميل
        checkOutBtn.disabled = true;
        checkOutBtn.innerHTML = '<i class="ph-fill ph-spinner-gap animate-spin"></i> جاري ...';

        // أولاً: إيقاف التتبع المباشر
        stopPersistentTracking(); 

        // ثانياً: محاولة تحديث قاعدة البيانات
        const { error } = await supabaseClient
            .from('attendance')
            .update({
                checkout_at: new Date(),
                status: 'اكمل المناوبة'
            })
            .eq('id', checkOutBtn.dataset.attendanceId);

        // ثالثاً: إبلاغ المستخدم بالنتيجة الحقيقية
        if (error) {
            alert('فشل تسجيل الانصراف. سيتم تحديث الواجهة لتعكس الحالة الصحيحة.');
            console.error('Checkout Error:', error);
        } else {
            alert('تم تسجيل انصرافك بنجاح.');
        }

        // رابعاً (الأهم): دائماً نُعيد تحميل الواجهة من قاعدة البيانات
        // لضمان عرض الحالة الصحيحة 100%
        loadAttendancePage(); 
    }
}
// ===================== نهاية الاستبدال =====================
// ===================== نهاية الاستبدال =====================
// ===================== نهاية الاستبدال =====================
// ===================== نهاية الاستبدال =====================

    // عند الضغط على زر "تسجيل انصراف"
    // ==================== بداية الاستبدال ====================
// عند الضغط على زر "تسجيل انصراف"

// ===================== نهاية الاستبدال =====================
// --- NEW: Guard Request Submission Logic ---
    // بداية الاستبدال

    const submitRequestBtn = event.target.closest('.btn-submit-request');
    if (submitRequestBtn) {
        event.preventDefault();
        
        const requestType = submitRequestBtn.dataset.requestType;
        if (!requestType || !currentUser) return;

        const modal = submitRequestBtn.closest('.modal-overlay');
        let details = {};
        let isValid = true;
        let requestTypeText = ''; // لعنوان الإشعار

        // تجميع البيانات من النموذج الصحيح بناءً على نوع الطلب
        switch (requestType) {
            case 'permission':
                const permissionReason = modal.querySelector('#permission-reason').value;
                if (!permissionReason.trim()) { alert('الرجاء كتابة سبب الاستئذان.'); isValid = false; }
                details = { reason: permissionReason };
                requestTypeText = 'استئذان';
                break;
            case 'leave':
                const leaveStartDate = modal.querySelector('#leave-start-date').value;
                const leaveDays = modal.querySelector('#leave-days').value;
                const leaveReason = modal.querySelector('#leave-reason').value;
                if (!leaveStartDate || !leaveDays || !leaveReason.trim()) { alert('الرجاء تعبئة جميع حقول طلب الإجازة.'); isValid = false; }
                details = { start_date: leaveStartDate, days: leaveDays, reason: leaveReason };
                requestTypeText = 'إجازة';
                break;
            case 'loan':
                const loanAmount = modal.querySelector('#loan-amount').value;
                const loanReason = modal.querySelector('#loan-reason').value;
                if (!loanAmount || !loanReason.trim()) { alert('الرجاء تحديد مبلغ السلفة وكتابة السبب.'); isValid = false; }
                details = { amount: loanAmount, reason: loanReason };
                requestTypeText = 'سلفة';
                break;
            case 'resignation':
                const resignationReason = modal.querySelector('#resignation-reason').value;
                if (!resignationReason.trim()) { alert('الرجاء كتابة سبب الاستقالة.'); isValid = false; }
                details = { reason: resignationReason };
                requestTypeText = 'استقالة';
                break;
        }

        if (!isValid) return;

        submitRequestBtn.disabled = true;
        submitRequestBtn.textContent = 'جاري الإرسال...';

        const requestData = {
            user_id: currentUser.id,
            request_type: requestType,
            details: details
        };

        const { error } = await supabaseClient.from('employee_requests').insert([requestData]);

        if (error) {
            console.error('Error submitting request:', error);
            alert('حدث خطأ أثناء إرسال طلبك. يرجى المحاولة مرة أخرى.');
            submitRequestBtn.disabled = false;
        } else {
            // --- إرسال إشعار للمدراء ---
            const { data: managers, error: managersError } = await supabaseClient
                .from('users')
                .select('id')
                .or('role.eq.مشرف,role.eq.ادارة العمليات')
                .eq('project', currentUser.project);

            if (managersError) {
                console.error('Could not fetch managers to notify:', managersError);
            } else if (managers && managers.length > 0) {
                const managerIds = managers.map(m => m.id);
                sendNotification(
                    managerIds,
                    `طلب ${requestTypeText} جديد`,
                    `قام الموظف ${currentUser.name} بتقديم طلب ${requestTypeText} جديد.`,
                    '#'
                );
            }
            // --- نهاية إرسال الإشعار ---

            alert('تم إرسال طلبك بنجاح.');
            modal.classList.add('hidden');
            loadMyRequestsPage();
        }
    }

// نهاية الاستبدال
    // ==================== بداية الإضافة ====================
// --- منطق قبول ورفض طلبات الاستئذان للمشرف ---
const actionBtn = event.target.closest('[data-action]');
if (actionBtn && actionBtn.dataset.requestId) {
    const requestId = actionBtn.dataset.requestId;
    const action = actionBtn.dataset.action;
    let success = false; // متغير لتتبع نجاح العملية

    if (action === 'approve') {
        if (confirm('هل أنت متأكد من قبول هذا الطلب؟')) {
            const { error } = await supabaseClient
                .from('employee_requests')
                .update({ status: 'مقبول' }) // تحديث الحالة إلى "مقبول"
                .eq('id', requestId);

            if (error) {
                alert('حدث خطأ أثناء قبول الطلب.');
                console.error('Approval error:', error);
            } else {
                alert('تم قبول الطلب بنجاح.');
                success = true;
            }
        }
    } else if (action === 'reject') {
        const reason = prompt('الرجاء إدخال سبب الرفض:');
        if (reason) { // نتأكد أن المشرف أدخل سبباً ولم يضغط "إلغاء"
            const { error } = await supabaseClient
                .from('employee_requests')
                .update({ status: 'مرفوض', rejection_reason: reason }) // تحديث الحالة وسبب الرفض
                .eq('id', requestId);

            if (error) {
                alert('حدث خطأ أثناء رفض الطلب.');
                console.error('Rejection error:', error);
            } else {
                alert('تم رفض الطلب.');
                success = true;
            }
        }
    }

    if (success) {
        // إذا نجحت العملية، نُعيد تحميل قائمة الطلبات
        // ليختفي الطلب الذي تمت معالجته
        loadPermissionRequests();
    }
}
// ===================== نهاية الإضافة =====================
    
});

}); // <-- هذا هو القوس المهم الذي كان مفقوداً ويغلق DOMContentLoaded

// --- 3. منطق تسجيل الدخول (خارج DOMContentLoaded لأنه يتعامل مع نموذج جاهز) ---
// ==================== بداية الاستبدال الكامل لمنطق الدخول ====================
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        console.log('%c--- بدأنا عملية تسجيل الدخول (النظام الجديد) ---', 'color: blue; font-weight: bold;');

        const idNumber = document.getElementById('id-number').value;
        const password = document.getElementById('password').value;
        const loginBtn = loginForm.querySelector('button[type="submit"]');

        if (!idNumber || !password) {
            return alert('الرجاء إدخال رقم الهوية وكلمة المرور.');
        }

        loginBtn.innerHTML = 'جاري التحقق...';
        loginBtn.disabled = true;

        // إنشاء الإيميل الوهمي من رقم الهوية
       const loginEmail = `${idNumber}@arknat-system.com`;

        // استخدام دالة تسجيل الدخول الرسمية من Supabase
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
            email: loginEmail,
            password: password,
        });

        if (authError) {
            console.error('!!! فشل تسجيل الدخول:', authError.message);
            alert('رقم الهوية أو كلمة المرور غير صحيحة.');
            loginBtn.disabled = false;
            loginBtn.innerHTML = 'تسجيل الدخول';
            return;
        }

        // إذا نجحت المصادقة، نجلب بيانات المستخدم الإضافية من جدول users
        if (authData.user) {
            const { data: userProfile, error: profileError } = await supabaseClient
                .from('users')
                .select('*')
                .eq('auth_user_id', authData.user.id) // الربط باستخدام هوية المصادقة
                .single();

            if (profileError || !userProfile) {
                console.error('!!! لم يتم العثور على ملف تعريف للمستخدم:', profileError);
                alert('حدث خطأ أثناء جلب بيانات المستخدم.');
                // نقوم بتسجيل الخروج كإجراء احترازي
                await supabaseClient.auth.signOut();
                loginBtn.disabled = false;
                loginBtn.innerHTML = 'تسجيل الدخول';
                return;
            }

            console.log('%cنجاح! تم العثور على المستخدم:', 'color: green; font-weight: bold;', userProfile);
            currentUser = userProfile;
            sessionStorage.setItem('currentUser', JSON.stringify(userProfile));
            await supabaseClient.from('audit_logs').insert({
             user_id: userProfile.auth_user_id,
             user_name: userProfile.name,
             action_type: 'تسجيل دخول ناجح',
             details: { role: userProfile.role }
            });
            updateNotificationBell(); // تحديث الجرس عند تسجيل الدخول
            setInterval(updateNotificationBell, 60000); // تحديث الجرس كل دقيقة
            

            // حفظ الجلسة الحقيقية (Supabase يقوم بذلك تلقائياً)
            // لم نعد بحاجة لـ sessionStorage

            updateUIVisibility(userProfile.role);
            document.getElementById('login-page').style.display = 'none';
            document.querySelector('.dashboard-container').classList.remove('hidden');

            const userProfileSpan = document.querySelector('.user-profile span');
            if (userProfileSpan) userProfileSpan.textContent = `مرحباً، ${userProfile.name}`;

            const firstVisibleLink = document.querySelector('.sidebar-nav li[style*="display: block"] a');
            if (firstVisibleLink) firstVisibleLink.click();
            displayActiveAnnouncements();
        }

        loginBtn.disabled = false;
        loginBtn.innerHTML = 'تسجيل الدخول';
        console.log('%c--- انتهت عملية تسجيل الدخول ---', 'color: blue; font-weight: bold;');
    });

// ==================== نهاية الاستبدال الكامل لمنطق الدخول ====================
    // ------------------------------------

// --- الخطوة 31: دالة لبناء واجهة صفحة الحضور للحارس ---
// --- الخطوة 31: دالة لبناء واجهة صفحة الحضور للحارس مع التحقق من الحالة ---


// ==================== بداية الاستبدال ====================

// ------------------------------------
}
// ------------------------------------

// --- الخطوة 33: دالة لبناء واجهة صفحة "طلباتي" للحارس ---
// --- الخطوة 35: تحديث دالة "طلباتي" بتصميم جديد ---
async function loadMyRequestsPage() {
    // 1. إعادة بناء هيكل الصفحة (هذا الجزء لا يتغير)
    const requestsContent = document.querySelector('#page-my-requests');
    requestsContent.innerHTML = `
        <div class="page-header"><h3>رفع طلب جديد</h3></div>
        <div class="requests-actions-container">
            <button class="request-action-card" data-request-type="permission" style="--card-color: #0d6efd;"><i class="ph-fill ph-clock-countdown"></i><h4>طلب استئذان</h4></button>
            <button class="request-action-card" data-request-type="leave" style="--card-color: #198754;"><i class="ph-fill ph-calendar-blank"></i><h4>طلب إجازة</h4></button>
            <button class="request-action-card" data-request-type="loan" style="--card-color: #ffc107;"><i class="ph-fill ph-hand-coins"></i><h4>طلب سلفة</h4></button>
            <button class="request-action-card" data-request-type="resignation" style="--card-color: #dc3545;"><i class="ph-fill ph-file-x"></i><h4>طلب استقالة</h4></button>
        </div>
        <div class="page-header" style="margin-top: 40px;"><h3>متابعة طلباتك السابقة</h3></div>
        <div id="past-requests-list"><p style="text-align: center; padding: 20px; color: var(--text-secondary);">جاري تحميل طلباتك...</p></div>
    `;

    // 2. الوصول إلى حاوية عرض الطلبات وقائمة الطلبات السابقة
    const pastRequestsList = document.getElementById('past-requests-list');

    // 3. التحقق من وجود مستخدم مسجل دخوله
    if (!currentUser) {
        pastRequestsList.innerHTML = '<p>الرجاء تسجيل الدخول لعرض طلباتك.</p>';
        return;
    }

    // 4. جلب الطلبات الخاصة بالمستخدم الحالي من قاعدة البيانات
    const { data: requests, error } = await supabaseClient
        .from('employee_requests')
        .select('*')
        .eq('user_id', currentUser.id) // فلترة الطلبات للمستخدم الحالي فقط
        .order('created_at', { ascending: false }); // عرض الأحدث أولاً

    if (error) {
        console.error('خطأ في جلب الطلبات:', error);
        pastRequestsList.innerHTML = '<p>حدث خطأ أثناء تحميل الطلبات.</p>';
        return;
    }

    // 5. التحقق إذا لم يكن هناك طلبات
    if (requests.length === 0) {
        pastRequestsList.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">لا توجد طلبات سابقة لعرضها.</p>';
        return;
    }

    // 6. مسح رسالة التحميل وتجهيز لعرض الطلبات
    pastRequestsList.innerHTML = '';

    // 7. المرور على كل طلب وإنشاء بطاقة عرض له
    requests.forEach(request => {
        // تحديد النص واللون الخاص بحالة الطلب
        let statusClass, statusText;
        switch (request.status) {
            case 'مقبول':
                statusClass = 'approved'; statusText = 'مقبول'; break;
            case 'مرفوض':
                statusClass = 'denied'; statusText = 'مرفوض'; break;
            default:
                statusClass = 'pending'; statusText = 'معلق';
        }
        
        // ترجمة نوع الطلب للعربية
        let requestTypeText;
        switch(request.request_type) {
            case 'leave': requestTypeText = 'طلب إجازة'; break;
            case 'loan': requestTypeText = 'طلب سلفة'; break;
            case 'permission': requestTypeText = 'طلب استئذان'; break;
            case 'resignation': requestTypeText = 'طلب استقالة'; break;
            default: requestTypeText = request.request_type;
        }

        const requestCard = `
            <div class="request-card">
                <div class="request-card-header">
                    <h4>${requestTypeText}</h4>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="request-card-body">
                    <p><strong>تاريخ الطلب:</strong> ${new Date(request.created_at).toLocaleDateString('ar-SA')}</p>
                    ${request.details && request.details.reason ? `<p><strong>السبب:</strong> ${request.details.reason}</p>` : ''}
                    ${request.details && request.details.days ? `<p><strong>عدد الأيام:</strong> ${request.details.days}</p>` : ''}
                    ${request.details && request.details.amount ? `<p><strong>المبلغ:</strong> ${request.details.amount} ر.س</p>` : ''}
                </div>
                ${request.status === 'مرفوض' && request.rejection_reason ? `
                <div class="request-card-footer">
                    <strong>سبب الرفض:</strong> ${request.rejection_reason}
                </div>` : ''}
            </div>
        `;
        pastRequestsList.insertAdjacentHTML('beforeend', requestCard);
    });



// نهاية الإضافة
// ==================== بداية الإضافة ====================
// ==========================================================
// ===     بداية دالة عرض الإعلانات النشطة للمستخدمين     ===
// ==========================================================

// ==========================================================
// ===      نهاية دالة عرض الإعلانات النشطة للمستخدمين      ===
// ==========================================================
// ===================== نهاية الإضافة =====================

}
// ==================== بداية كود تفعيل نافذة عرض الصورة المكبرة ====================
document.addEventListener('DOMContentLoaded', () => {

// --- منطق صفحة إدخال البيانات الجديدة ---
const dataEntryPage = document.getElementById('page-hr-data-entry');
if(dataEntryPage) {
    // زر تحميل القالب
    const downloadBtn = document.getElementById('download-template-btn');
    downloadBtn.addEventListener('click', downloadEmployeeTemplate);

    // زر رفع الملف
    const uploadBtn = document.getElementById('upload-employees-file-btn');
    const fileInput = document.getElementById('employees-file-input');
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            processEmployeeFile(file);
        }
    });
}


// --- منطق إرسال الشكوى أو الاقتراح ---
document.getElementById('feedback-form')?.addEventListener('submit', async function(event) {
    event.preventDefault();
    const content = document.getElementById('feedback-content').value;
    if (!content.trim()) return alert('الرجاء كتابة محتوى الرسالة.');

    const feedbackData = {
        user_id: currentUser?.auth_user_id || null,
        user_name: currentUser?.name || 'زائر',
        feedback_type: document.getElementById('feedback-type').value,
        content: content,
        status: 'جديدة'
    };

    const { error } = await supabaseClient.from('feedback').insert(feedbackData);
    if (error) {
        alert('حدث خطأ أثناء الإرسال.');
    } else {
        alert('تم إرسال رسالتك بنجاح. شكراً لك.');
        document.getElementById('feedback-modal').classList.add('hidden');
        this.reset();
    }
});

    
    // لا تفعل شيئاً إذا لم نجد هذه العناصر (لأن الكود قد يعمل في صفحات أخرى)
    const imageViewerModal = document.getElementById('image-viewer-modal');
    if (!imageViewerModal) return; 

    const zoomedImage = document.getElementById('zoomed-image');
    const closeBtn = imageViewerModal.querySelector('.modal-close-btn');

    // وظيفة إغلاق النافذة
    const closeModal = () => {
        imageViewerModal.classList.add('hidden');
        zoomedImage.src = ''; // إفراغ الصورة لمنع ظهورها للحظة عند الفتح مرة أخرى
    };

    // المستمع الرئيسي الذي يراقب كل النقرات في الصفحة
    document.addEventListener('click', function(event) {
        const target = event.target;
        
        // التحقق إذا كانت الصورة قابلة للعرض
        if (target.classList.contains('viewable-image')) {
            // التحقق من أن الرابط ليس صورة placeholder
            if (target.src && !target.src.endsWith('placeholder.png')) {
                zoomedImage.src = target.src;
                imageViewerModal.classList.remove('hidden');
            } else {
                alert('لا يمكن عرض هذه الصورة حالياً.');
            }
        }
    });

    // ربط زر الإغلاق
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    // ربط النقر على الخلفية للإغلاق
    imageViewerModal.addEventListener('click', (event) => {
        // يتم الإغلاق فقط عند النقر على الخلفية نفسها وليس على الصورة
        if (event.target === imageViewerModal) {
            closeModal();
        }
    });
});
// ==================== نهاية كود تفعيل نافذة عرض الصورة المكبرة ====================
// ------------------------------------
// ------------------------------------

// =========================================================================
