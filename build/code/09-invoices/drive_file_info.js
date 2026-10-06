// Keeps the downloaded file and records where it came from.
const meta = $('New File in Drive Folder').item.json;
return {
  json: {
    file_name: meta.name || 'file',
    file_link: meta.webViewLink || (meta.id ? `https://drive.google.com/file/d/${meta.id}/view` : ''),
    drive_file_id: meta.id || '',
    source: 'Google Drive',
    notes: '',
  },
  binary: $input.item.binary,
};
