/* 麻雀观影护照 · 生态导入导出（Letterboxd / 豆瓣 CSV）与备份健康检查（网站与小程序共用）。 */
(function (root) {
  'use strict';

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function parseCSV(text) {
    var s = String(text || '').replace(/^\uFEFF/, '');
    var rows = [], row = [], cur = '', inQ = false;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (inQ) {
        if (ch === '"') {
          if (s[i + 1] === '"') { cur += '"'; i++; }
          else inQ = false;
        } else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ',') { row.push(cur); cur = ''; }
        else if (ch === '\r') { if (s[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
        else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
        else cur += ch;
      }
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
  }

  // Export watched films to official Letterboxd CSV format.
  // includeNotes defaults to false so private notes never leak unintentionally.
  function exportLetterboxdCSV(entries, opts) {
    opts = opts || {};
    var includeNotes = !!opts.includeNotes;
    var notes = opts.notes || {};
    var progNameOf = opts.progNameOf || function () { return ''; };
    var header = includeNotes
      ? ['Title', 'Year', 'Directors', 'WatchedDate', 'Rating10', 'Tags', 'Review']
      : ['Title', 'Year', 'Directors', 'WatchedDate', 'Rating10', 'Tags'];
    var lines = [header.join(',')];
    (entries || []).forEach(function (e) {
      var f = e.f || e.film, rec = e.rec || {};
      if (!f || !rec.d || rec.del) return;
      var title = f.en || f.o || f.cn || '';
      var yr = parseInt(f.y, 10);
      var year = Number.isFinite(yr) ? String(yr) : '';
      var dir = f.dirO || f.dir || '';
      var r10 = rec.r > 0 ? String(rec.r) : '';
      var tags = ['sparrow-film-passport'];
      var pn = progNameOf(f);
      if (pn) tags.push(String(pn).replace(/,/g, ' '));
      var row = [title, year, dir, rec.d, r10, tags.join(', ')];
      if (includeNotes) {
        var n = notes[f.id];
        row.push(n && !n.del && typeof n.s === 'string' ? n.s : '');
      }
      lines.push(row.map(csvCell).join(','));
    });
    return lines.join('\r\n') + '\r\n';
  }

  function normTitle(s) {
    return String(s || '').toLowerCase().replace(/[\s:：·・\-—,.，。!！?？'’"“”()（）《》\[\]]/g, '');
  }

  function lbSlug(uri) {
    var m = String(uri || '').match(/letterboxd\.com\/film\/([^/?#]+)/i);
    return m ? m[1].toLowerCase() : '';
  }

  function doubanId(uri) {
    var m = String(uri || '').match(/douban\.com\/subject\/(\d+)/i) || String(uri || '').match(/^(\d{6,12})$/);
    return m ? m[1] : '';
  }

  function parseDateISO(raw) {
    var s = String(raw || '').trim();
    var m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (!m) return '';
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
    return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  function parseRating10(raw, scale) {
    var n = parseFloat(String(raw || '').trim());
    if (!Number.isFinite(n) || n <= 0) return 0;
    if (scale === 5 || n <= 5) return Math.max(1, Math.min(10, Math.round(n * 2)));
    return Math.max(1, Math.min(10, Math.round(n)));
  }

  // Parse Letterboxd (watched/diary/watchlist/reviews) or Douban CSV and match against catalog films.
  function parseImportCSV(csvText, films, existingWatched) {
    var rows = parseCSV(csvText);
    if (rows.length < 2) return { source: 'unknown', matched: [], unmatchedCount: 0, totalRows: 0 };
    var head = rows[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
    var col = function (names) {
      for (var i = 0; i < names.length; i++) {
        var idx = head.indexOf(names[i].toLowerCase());
        if (idx >= 0) return idx;
      }
      return -1;
    };

    var isDouban = head.some(function (h) { return /豆瓣|片名|标题|我的评分|标记日期|收藏状态/.test(h); });
    var isLB = !isDouban && (col(['letterboxd uri']) >= 0 || (col(['name', 'title']) >= 0 && col(['year']) >= 0 && (col(['watched date', 'watcheddate', 'rating10', 'rating', 'directors']) >= 0)));
    var source = isDouban ? 'douban' : isLB ? 'letterboxd' : 'csv';

    var iName = col(['name', 'title', '片名', '标题', '电影名', '名称']);
    var iYear = col(['year', '年份', '上映年份']);
    var iUri = col(['letterboxd uri', 'url', '链接', '豆瓣链接', '网址', 'subject']);
    var iDate = col(['watched date', 'watcheddate', 'date', '日期', '标记日期', '观看日期', '创建时间']);
    var iRating10 = col(['rating10', '十分制评分']);
    var iRating5 = col(['rating', '我的评分', '评分', '星级']);
    var iStatus = col(['status', '状态', '收藏状态', '类型']);
    var iReview = col(['review', '短评', '评论', '笔记', 'comment']);

    // Build lookup indexes
    var byLb = {}, byDb = {}, byTitle = {};
    (films || []).forEach(function (f) {
      if (!f || f.ev) return;
      if (f.links && f.links.lb) byLb[String(f.links.lb).toLowerCase()] = f;
      if (f.links && f.links.douban) byDb[String(f.links.douban)] = f;
      [f.en, f.o, f.cn, f.cnZh, f.cnDb].concat(f.titleAliases || []).forEach(function (t) {
        var k = normTitle(t);
        if (!k) return;
        if (!byTitle[k]) byTitle[k] = [];
        if (byTitle[k].indexOf(f) < 0) byTitle[k].push(f);
      });
    });

    var isWatchlistFile = !isDouban && iRating5 < 0 && iRating10 < 0 && col(['watched date', 'watcheddate']) < 0 && iReview < 0 && head.length <= 4 && col(['letterboxd uri']) >= 0;
    var matched = [], seenId = {}, unmatchedCount = 0;

    for (var r = 1; r < rows.length; r++) {
      var line = rows[r];
      var name = iName >= 0 ? String(line[iName] || '').trim() : '';
      var yr = iYear >= 0 ? parseInt(line[iYear], 10) : NaN;
      var uri = iUri >= 0 ? String(line[iUri] || '').trim() : '';
      var f = null;

      var slug = lbSlug(uri);
      if (slug && byLb[slug]) f = byLb[slug];
      if (!f) {
        var did = doubanId(uri);
        if (did && byDb[did]) f = byDb[did];
      }
      if (!f && name) {
        var cands = byTitle[normTitle(name)] || [];
        if (cands.length === 1) {
          var cy = parseInt(cands[0].y, 10);
          if (!Number.isFinite(yr) || !Number.isFinite(cy) || Math.abs(cy - yr) <= 1) f = cands[0];
        } else if (cands.length > 1 && Number.isFinite(yr)) {
          f = cands.find(function (x) { return Math.abs(parseInt(x.y, 10) - yr) <= 1; }) || null;
        }
      }

      if (!f) { unmatchedCount++; continue; }
      if (seenId[f.id]) continue;
      seenId[f.id] = 1;

      var stRaw = iStatus >= 0 ? String(line[iStatus] || '').trim().toLowerCase() : '';
      var isWant = isWatchlistFile || /想看|wish|watchlist/.test(stRaw);
      var date = iDate >= 0 ? parseDateISO(line[iDate]) : '';
      var rating10 = iRating10 >= 0 && line[iRating10] ? parseRating10(line[iRating10], 10) : (iRating5 >= 0 ? parseRating10(line[iRating5], isDouban ? 5 : 5) : 0);
      var note = iReview >= 0 ? String(line[iReview] || '').trim().slice(0, 1000) : '';
      var ex = existingWatched && existingWatched[f.id];
      var alreadyWatched = !!(ex && !ex.del && ex.d);

      matched.push({
        film: f,
        kind: isWant ? 'want' : 'watched',
        date: date,
        rating10: isWant ? 0 : rating10,
        note: note,
        alreadyWatched: alreadyWatched
      });
    }

    return { source: source, matched: matched, unmatchedCount: unmatchedCount, totalRows: rows.length - 1 };
  }

  // Backup & sync health computation (non-nagging, actionable)
  function backupHealth(o) {
    o = o || {};
    var now = o.now || Date.now();
    var syncCode = String(o.syncCode || '');
    var codeSaved = !!o.codeSaved;
    var watchedCount = Number(o.watchedCount || 0);
    var notesCount = Number(o.notesCount || 0);
    var totalItems = watchedCount + notesCount;
    var lastExportAt = Number(o.lastExportAt || 0);
    var lastExportCount = Number(o.lastExportCount || 0);
    var daysSinceBackup = lastExportAt ? Math.floor((now - lastExportAt) / 86400000) : -1;
    var newSinceBackup = Math.max(0, totalItems - lastExportCount);

    var codeWarning = !!(syncCode && !codeSaved);
    var backupWarning = false;
    var backupReason = '';
    if (totalItems >= 5) {
      if (!lastExportAt && !syncCode) {
        backupWarning = true;
        backupReason = '本地已有 ' + totalItems + ' 条记录，建议开启云端同步或下载本地备份';
      } else if (lastExportAt && daysSinceBackup >= 30 && newSinceBackup > 0) {
        backupWarning = true;
        backupReason = '距上次本地备份已 ' + daysSinceBackup + ' 天（期间新增 ' + newSinceBackup + ' 条记录）';
      } else if (lastExportAt && newSinceBackup >= 10) {
        backupWarning = true;
        backupReason = '自上次备份后新增 ' + newSinceBackup + ' 条记录，建议更新本地备份';
      } else if (!lastExportAt && totalItems >= 10) {
        backupWarning = true;
        backupReason = '尚未导出过本地备份文件，建议定期留存一份离线副本';
      }
    }

    var level = codeWarning ? 'warn' : backupWarning ? 'info' : 'good';
    return {
      level: level,
      syncEnabled: !!syncCode,
      codeSaved: codeSaved,
      codeWarning: codeWarning,
      backupWarning: backupWarning,
      backupReason: backupReason,
      daysSinceBackup: daysSinceBackup,
      newSinceBackup: newSinceBackup,
      totalItems: totalItems
    };
  }

  var api = { parseCSV: parseCSV, exportLetterboxdCSV: exportLetterboxdCSV, parseImportCSV: parseImportCSV, backupHealth: backupHealth };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SparrowEcosystem = api;
})(typeof window !== 'undefined' ? window : this);
