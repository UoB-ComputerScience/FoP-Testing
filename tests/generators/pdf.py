"""Generate PDF cases; requires reportlab, Pillow and pypdf."""
from common import options, save as save_file, finish
import io
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image, ImageDraw
from pypdf import PdfReader, PdfWriter
from pypdf.generic import EncodedStreamObject, NameObject
args = options(__doc__, font=True)

def save(name, data):
    save_file(args.output, name, data)

def pdf(pages=1, scan=False, blank=False, mixed=False, font='Helvetica'):
    out = io.BytesIO()
    c = canvas.Canvas(out, pageCompression=1)
    for i in range(pages):
        if scan or (mixed and i == 1):
            image = Image.new('RGB', (800, 300), 'white')
            ImageDraw.Draw(image).text((30, 30), 'Synthetic scanned report page. The report is present as an image.', fill='black')
            c.drawImage(ImageReader(image), 50, 450, width=480, height=180)
        elif not blank:
            c.setFont(font, 12)
            c.drawString(60, 740, 'Synthetic report page. This explains the coursework solution.')
            if font != 'Helvetica':
                c.drawString(60, 715, 'Résumé café naïve report')
        c.showPage()
    c.save()
    return out.getvalue()
text = pdf(3)
save('01-text-report.pdf', text)
save('02-scanned-report.pdf', pdf(scan=True))
save('03-blank-report.pdf', pdf(blank=True))
writer = PdfWriter()
writer.append(PdfReader(io.BytesIO(text)))
writer.encrypt('archive-test')
out = io.BytesIO()
writer.write(out)
save('04-password-protected.pdf', out.getvalue())
save('05-truncated.pdf', text[:180])
save('06-fake-pdf.pdf', b'Not a PDF, just a renamed text file.')
save('07-pdf-renamed-docx.docx', text)
save('08-missing-eof-marker.pdf', text[:text.rfind(b'%%EOF')])
save('09-text-and-scan.pdf', pdf(2, mixed=True))
save('10-over-page-limit.pdf', pdf(201, blank=True))
writer = PdfWriter()
writer.append(PdfReader(io.BytesIO(text)))
writer.encrypt('', owner_password='owner-only', permissions_flag=4)
out = io.BytesIO()
writer.write(out)
save('11-no-opening-password.pdf', out.getvalue())
pdfmetrics.registerFont(TTFont('FixtureUnicode', str(args.font)))
save('12-unicode-report.pdf', pdf(font='FixtureUnicode'))
writer = PdfWriter()
writer.append(PdfReader(io.BytesIO(text)))
bad = EncodedStreamObject()
bad._data = b'corrupted flate stream'
bad[NameObject('/Filter')] = NameObject('/FlateDecode')
writer.pages[0][NameObject('/Contents')] = writer._add_object(bad)
out = io.BytesIO()
writer.write(out)
save('13-damaged-page-stream.pdf', out.getvalue())
finish(args, 'Reports')
