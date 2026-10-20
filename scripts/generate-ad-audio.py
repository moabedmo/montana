import asyncio
import os
import edge_tts

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'audio', 'ads')
os.makedirs(OUT_DIR, exist_ok=True)

SCRIPTS = [
    # Video 1: Whitening Cream
    {
        'id': 'v1_scene1',
        'text': 'بصي بقى يا حبيبتي.. أكبر غلطة البنات بتعملها هي التقشير العنيف والخلطات الحارقة! الجلد هناك رقيق جداً، والحل مش إنك تجرحيه، الحل إنك توقفي إفراز الميلانين بتركيبة طبية خالية تماماً من الهيدروكينون!'
    },
    {
        'id': 'v1_scene2',
        'text': 'كريم مونتانا للتفتيح بيمتص في ثواني بدون أي ملمس دهني، بيفتح التصبغات في الركب والبكيني بأمان تام! اطلبيه دلوقتي من اللينك والشحن مجاني!'
    },

    # Video 2: Acne Cleanser
    {
        'id': 'v2_scene1',
        'text': 'عارفة ليه الحبوب المدفونة دي مش بتروح؟ عشان الغسول العادي بينضف السطح بس، لكن المسام جواها دهون وجلد ميت محبوسين! إنتي محتاجة ساليسيليك طبيعي يدخل يدوب الدهون دي من غير ما ينشف وشك!'
    },
    {
        'id': 'v2_scene2',
        'text': 'غسول مونتانا لحب الشباب بالزنك وشجرة الشاي بينضف المسام في دقيقة، وبيسيب البشرة رطبة وصافية! اغسلي بيه صبح وليل، واللينك تحت عشان تطلبيه!'
    },

    # Video 3: Post-Laser Cream (Mebo alternative)
    {
        'id': 'v3_scene1',
        'text': 'كلنا عارفين معاناة ريحة السمسم القوية والتزييت اللي بيبهدل الهدوم! زمان كان ده الحل الوحيد، بس دلوقتي فيه كريمات ترميم طبية بتدي نفس التسكين السريع من غير ولا نقطة ريحة مزعجة!'
    },
    {
        'id': 'v3_scene2',
        'text': 'كريم مونتانا بعد الليزر بالنياسيناميد وشمع العسل.. بيهدي الالتهاب فورياً، بيمنع الاسمرار، ومالوش أي ريحة! اطلبيه دلوقتي وخليه أساسي بعد كل جلسة!'
    },

    # Video 4: Body & Hand Lotion (Strawberry skin)
    {
        'id': 'v4_scene1',
        'text': 'جلد الوزة بيحصل لما البصيلات تتسد خلايا ميتة بسبب الجفاف الشديد! واللوشن الخفيف بيتبخر في نص ساعة.. الحل إنك تحبسي المية جوة الجلد بمرطب طبي مكثف يدوم 72 ساعة!'
    },
    {
        'id': 'v4_scene2',
        'text': 'لوشن مونتانا لليدين والجسم بيطري الجلد الخشن ويخلي ملمس الساقين ناعم زي الحرير من أول استخدام! اطلبيه دلوقتي والشحن مجاني!'
    },

    # Video 5: Brightening Duo Routine
    {
        'id': 'v5_scene1',
        'text': 'لو عندك مناسبة أو فرح وعايزة وشك ينور، السر كله في خطوتين مش أكتر: غسول بيقشر ويفتح بلطف، وكريم مركز بيعالج البقع والكلف من الجذور!'
    },
    {
        'id': 'v5_scene2',
        'text': 'روتين التفتيح المزدوج من مونتانا: غسول العرقسوس وفيتامين سي مع كريم التفتيح الطبي.. نضارة فورية وبشرة صافية! اطلبي الروتين دلوقتي بالشحن المجاني من اللينك!'
    },
]

async def main():
    print('Generating Egyptian voiceovers using ar-EG-SalmaNeural...')
    for item in SCRIPTS:
        out_path = os.path.join(OUT_DIR, f"{item['id']}.mp3")
        # rate='+6%' gives a fresh, energetic influencer conversational tempo like Menna Abuzied
        comm = edge_tts.Communicate(item['text'], 'ar-EG-SalmaNeural', rate='+6%', pitch='+2Hz')
        await comm.save(out_path)
        print(f"Generated: {item['id']}.mp3 ({os.path.getsize(out_path)} bytes)")
    print('\nAll 10 voiceovers generated successfully!')

if __name__ == '__main__':
    asyncio.run(main())
