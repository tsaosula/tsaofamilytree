/*
 * ============================================================================
 * Google Apps Script Code for Family Tree App (v3 - Conflict Prevention)
 * ============================================================================
 * 
 * 版本：v3_conflict_prevention_with_email
 * 功能：增加樂觀鎖機制，增加「配偶電話」與「Email」欄位，修復電話號碼開頭 0 消失的問題。
 */

const SCRIPT_VERSION = "v3_conflict_prevention";

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    const props = PropertiesService.getScriptProperties();
    
    // 獲取目前雲端版本 ID (若無則初始化)
    let currentVersion = props.getProperty('DATA_VERSION');
    if (!currentVersion) {
      currentVersion = new Date().getTime().toString();
      props.setProperty('DATA_VERSION', currentVersion);
    }

    // ==========================================
    // POST: 更新資料 (需檢查版本)
    // ==========================================
    if (e.postData && e.postData.contents) {
      const payload = JSON.parse(e.postData.contents);
      const data = payload.data;
      const clientExpectedVersion = payload.version;

      // 檢查版本衝突
      if (clientExpectedVersion && clientExpectedVersion !== currentVersion) {
        return ContentService.createTextOutput(JSON.stringify({ 
          status: "conflict", 
          message: "資料已被他人更新，請重新整理頁面以取得最新版本。",
          currentVersion: currentVersion 
        })).setMimeType(ContentService.MimeType.JSON);
      }

      if (!Array.isArray(data)) throw new Error("Payload data must be an array");

      const headers = ['Name', 'SpouseName', 'Father', 'Mother', 'Generation', 'CourtesyName', 'Notes', 'gender', 'birthDate', 'deathDate', 'location', 'Phone', 'SpousePhone', 'Email'];
      
      // 寫入時強制將電話號碼轉為字串格式
      const rows = data.map(item => {
        const phone = item.phone ? "'" + String(item.phone).replace(/^'/, '') : '';
        const sPhone = item.spousePhone ? "'" + String(item.spousePhone).replace(/^'/, '') : '';
        
        return [
          item.name || '', item.spouseName || '', item.fatherName || '', item.motherName || '', 
          item.generation || '', item.courtesyName || '', item.biography || '', 
          item.gender || '', item.birthDate || '', item.deathDate || '', 
          item.location || '', phone, sPhone, item.email || ''
        ];
      });

      sheet.clearContents();
      sheet.appendRow(headers);
      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      }

      // 成功更新後，產生新的版本 ID
      const newVersion = new Date().getTime().toString();
      props.setProperty('DATA_VERSION', newVersion);

      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        count: rows.length, 
        version: newVersion,
        scriptVersion: SCRIPT_VERSION 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ==========================================
    // GET: 讀取資料 (回傳資料 + 目前版本)
    // ==========================================
    else {
      const data = sheet.getDataRange().getDisplayValues();
      if (data.length === 0) {
        return ContentService.createTextOutput(JSON.stringify({
          data: [],
          version: currentVersion
        })).setMimeType(ContentService.MimeType.JSON);
      }

      const headers = data[0];
      const rows = data.slice(1);
      const results = rows.map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          let key = header;
          if (header === 'Name') key = 'name';
          else if (header === 'SpouseName') key = 'spouseName';
          else if (header === 'Father') key = 'fatherName';
          else if (header === 'Mother') key = 'motherName';
          else if (header === 'Generation') key = 'generation';
          else if (header === 'CourtesyName') key = 'courtesyName';
          else if (header === 'Notes') key = 'biography'; 
          else if (header === 'gender') key = 'gender';
          else if (header === 'birthDate') key = 'birthDate';
          else if (header === 'deathDate') key = 'deathDate';
          else if (header === 'location' || header === 'Location') key = 'location';
          else if (header === 'Phone') key = 'phone';
          else if (header === 'SpousePhone') key = 'spousePhone';
          else if (header === 'Email') key = 'email';
          obj[key] = row[index];
        });
        return obj;
      });

      return ContentService.createTextOutput(JSON.stringify({
        data: results,
        version: currentVersion,
        scriptVersion: SCRIPT_VERSION
      })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}