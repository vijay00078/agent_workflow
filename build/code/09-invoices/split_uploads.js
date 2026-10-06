// The upload form can receive several files at once → one item per file.
const out = [];
for (const item of $input.all()) {
  const notes = item.json['Notes (optional)'] || '';
  for (const [key, file] of Object.entries(item.binary || {})) {
    out.push({
      json: { file_name: file.fileName || key, file_link: '', drive_file_id: '', source: 'Upload form', notes },
      binary: { data: file },
    });
  }
}
if (!out.length) throw new Error('No file was uploaded.');
return out;
