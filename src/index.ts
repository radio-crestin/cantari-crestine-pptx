import {Hono} from 'hono'
import PptxGenJS from 'pptxgenjs'

const app = new Hono()

app.get('/', (c) => {
    const instructions = `
Bun venit la Generatorul de PPTX pentru Cântări Creștine!

Pentru a genera o prezentare PowerPoint pentru un cântec:

1. Găsiți ID-ul cântecului de pe Resurse Creștine
2. Vizitați /song/{id} pentru a descărca PPTX-ul
   
Exemple:
- /song/249448 - fundal alb (implicit)
- /song/249448?bg=black - fundal negru
- /song/249448?bg=white - fundal alb

Aceasta va genera o prezentare PowerPoint pentru cântecul cu ID-ul 249448.

PPTX-ul va include:
- Fiecare tip de slide în ordinea cântecului
- Formatare corectă a textului
- "Amin!" pe ultimul slide
- Titlul și autorul cântecului
- Fundal alb sau negru (specificat prin parametrul bg)

Spor la utilizare! 🎵
`

    return c.text(instructions.trim())
})

app.get('/song/:id', async (c) => {
    const id = c.req.param('id')
    const bg = c.req.query('bg') || 'white' // Default to white background
    const isBlackBg = bg === 'black'

    // Set colors based on background
    const backgroundColor = isBlackBg ? '000000' : 'FFFFFF'
    const textColor = isBlackBg ? 'FFFFFF' : '000000'

    try {
        // Fetch song data
        const response = await fetch(`https://www.resursecrestine.ro/ajax/api/proiectie/cere-cantec-dupa-id?id=${id}`)
        if (!response.ok) throw new Error('Failed to fetch song data')

        const data = await response.json() as any;
        if (!data) {
          throw new Error('Invalid song data')
        }
        const song = data.cantec

        // Create new PPTX
        const pptx = new PptxGenJS()

        // Set presentation title
        pptx.title = song.titlu
        pptx.author = song.autor

        // Create slides based on order, filtering out types without content
        const order = song.ordine.split(' ').filter((slideType: string) =>
            song.continut.some((c: any) => c.tip === slideType)
        )

        order.forEach((slideType: string, index: number) => {
            const content = song.continut.find((c: any) => c.tip === slideType)
            const slide = pptx.addSlide();
            slide.background = {color: backgroundColor};
            // Convert HTML to formatted text
            const formattedText = content.text
                .replace(/<br\s*\/?>/gi, '\n') // Convert <br> to newlines
                .replace(/<b>(.*?)<\/b>/gi, '$1') // Remove bold tags (PPTX handles bold via options)
                .replace(/<i>(.*?)<\/i>/gi, '$1') // Remove italic tags
                .replace(/<[^>]+>/g, '') // Remove all other HTML tags
                .trim();

            slide.addText(formattedText, {
                x: 0.5,
                y: 0,
                w: '90%',
                h: '90%',
                fontSize: 36, // Increased font size
                align: 'center',
                valign: 'middle',
                bold: content.text.includes('<b>'), // Apply bold if original had bold tags
                italic: content.text.includes('<i>'), // Apply italic if original had italic tags
                color: textColor
            })

            // Add "Amin!" to bottom right of last slide
            if (index === order.length - 1) {
                slide.addText('Amin!', {
                    x: '75%',
                    y: '90%',
                    w: 2,
                    h: 0.5,
                    fontSize: 24,
                    align: 'right',
                    valign: 'bottom',
                    color: textColor
                })
            }
        })

        // Generate PPTX as base64
        const base64 = await pptx.write({outputType: 'base64'})

        // Convert base64 to ArrayBuffer
        const binaryString = atob(base64 as string)
        const len = binaryString.length
        const bytes = new Uint8Array(len)
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i)
        }

        // Return as downloadable file
        return new Response(bytes.buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(song.titlu)}.pptx"`
            }
        })

    } catch (error) {
        console.error(error)
        return c.text('Error generating presentation', 500)
    }
})

export default app
