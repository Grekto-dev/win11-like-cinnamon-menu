// Uneven first-column natural widths formerly shifted the second column.
module.exports = [
    {title: 'Notes.txt', subtitle: 'Now'},
    {title: 'Quarterly budget', subtitle: 'Yesterday'},
    {title: 'A filename much longer than both first-column neighbours '.repeat(8) + '.pdf', subtitle: '/home/user/a directory with many words/'.repeat(5)},
    {title: 'Short.md', subtitle: '3 minutes ago'},
    {title: '一份包含很多字符的报告'.repeat(12) + '.docx', subtitle: 'A very long localized description '.repeat(7)},
    {title: 'x'.repeat(400) + '.xlsx', subtitle: 'Last week'}
];
