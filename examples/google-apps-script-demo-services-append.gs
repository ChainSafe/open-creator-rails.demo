/**
 * Google Apps Script — read/write creator rows for the OCR demo.
 *
 * Setup:
 * 1. Open your Google Sheet → Extensions → Apps Script
 * 2. Paste this file, save
 * 3. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the Web app URL → VITE_DEMO_SERVICES_SHEET_WRITE_URL in .env.anvil
 *    (App uses this URL for live reads via GET and writes via POST.)
 *
 * Sheet row 1 must be:
 * address, name, avatarUrl, contentImageUrl, videoUrl, article
 */

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents)
    const address = String(body.address || '').trim().toLowerCase()
    const name = String(body.name || '').trim()
    if (!address.startsWith('0x') || !name) {
      throw new Error('Missing address or name')
    }

    const row = [
      address,
      name,
      String(body.avatarUrl || ''),
      String(body.contentImageUrl || ''),
      String(body.videoUrl || ''),
      String(body.article || ''),
    ]

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]
    const values = sheet.getDataRange().getValues()
    if (values.length === 0) {
      sheet.appendRow(['address', 'name', 'avatarUrl', 'contentImageUrl', 'videoUrl', 'article'])
      sheet.appendRow(row)
    } else {
      const header = values[0].map(function (h) {
        return String(h).trim().toLowerCase()
      })
      const addrCol = header.indexOf('address')
      if (addrCol < 0) {
        throw new Error('Sheet must have an "address" column in row 1')
      }

      var updated = false
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][addrCol] || '').trim().toLowerCase() === address) {
          sheet.getRange(i + 1, 1, 1, row.length).setValues([row])
          updated = true
          break
        }
      }
      if (!updated) {
        sheet.appendRow(row)
      }
    }

    return jsonResponse({ ok: true })
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) })
  }
}

/** Live read — avoids stale published CSV after POST. */
function doGet() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]
    const values = sheet.getDataRange().getValues()
    if (values.length < 2) {
      return jsonResponse({ ok: true, rows: [] })
    }

    const header = values[0].map(function (h) {
      return String(h).trim().toLowerCase()
    })
    const col = function (names) {
      for (var n = 0; n < names.length; n++) {
        var i = header.indexOf(names[n])
        if (i >= 0) return i
      }
      return -1
    }

    const addrCol = col(['address', 'assetaddress', 'asset'])
    const nameCol = col(['name'])
    const avatarCol = col(['avatarurl', 'avatar'])
    const imageCol = col(['contentimageurl', 'contentimage', 'imageurl'])
    const videoCol = col(['videourl', 'video', 'youtubeurl'])
    const articleCol = col(['article'])

    if (addrCol < 0 || nameCol < 0) {
      throw new Error('Sheet must have address and name columns in row 1')
    }

    var rows = []
    for (var r = 1; r < values.length; r++) {
      var address = String(values[r][addrCol] || '').trim().toLowerCase()
      var name = String(values[r][nameCol] || '').trim()
      if (!address.startsWith('0x') || !name) continue
      rows.push({
        address: address,
        name: name,
        avatarUrl: avatarCol >= 0 ? String(values[r][avatarCol] || '') : '',
        contentImageUrl: imageCol >= 0 ? String(values[r][imageCol] || '') : '',
        videoUrl: videoCol >= 0 ? String(values[r][videoCol] || '') : '',
        article: articleCol >= 0 ? String(values[r][articleCol] || '') : '',
      })
    }

    return jsonResponse({ ok: true, rows: rows })
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) })
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  )
}
