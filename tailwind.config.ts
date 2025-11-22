@tailwind base;
@tailwind components;
@tailwind utilities;

/* ---------------------------------
SVĚTLÝ REŽIM (Default: :root)
---------------------------------
*/
:root {
  /* Základní barvy */
  --background: 255 255 255; /* Čistá bílá */
  --foreground: 10 10 10;    /* Téměř černý text */
  --card: 250 250 250;       /* Velmi světle šedá pro boxy */
  
  /* Akcenty a Interakce */
  --primary: 0 115 255;          /* Standardní modrá (pro viditelnost) */
  --primary-foreground: 255 255 255; /* Bílý text na primární barvě */
  --secondary: 240 240 240;      /* Světlejší šedá pro sekundární tlačítka */
  --secondary-foreground: 10 10 10;
  
  /* Hranice a stíny (pro moderní ostrý vzhled) */
  --border: 220 220 220;
  --ring: 0 115 255; /* Stejná barva jako Primary */
  
  /* Další systémové barvy */
  --muted: 245 245 245;
  --muted-foreground: 128 128 128;
  --accent: 245 245 245;
  --accent-foreground: 10 10 10;
  --destructive: 255 0 0;
  --destructive-foreground: 255 255 255;
  --input: 240 240 240;
}

/* ---------------------------------
TMAVÝ REŽIM (.dark class)
---------------------------------
*/
.dark {
  /* Základní barvy - Hluboký, tmavý podklad (inspirováno Neon Labs/Github) */
  --background: 15 15 18;     /* Téměř černá */
  --foreground: 240 240 240;   /* Velmi světlý text */
  --card: 25 25 30;          /* O něco tmavší pozadí pro boxy/karty */

  /* Akcenty a Interakce - Neonově modrá/kyanová */
  --primary: 0 255 255;          /* Neon Cyan/Modrá */
  --primary-foreground: 15 15 18; /* Tmavý text na neonovém akcentu pro vysoký kontrast */
  --secondary: 40 40 50;         /* Tmavě šedá pro sekundární tlačítka */
  --secondary-foreground: 240 240 240;
  
  /* Hranice a stíny */
  --border: 45 45 50;
  --ring: 0 255 255; /* Stejná barva jako Primary */
  
  /* Další systémové barvy */
  --muted: 30 30 35;
  --muted-foreground: 160 160 160;
  --accent: 40 40 50;
  --accent-foreground: 240 240 240;
  --destructive: 255 0 0;
  --destructive-foreground: 240 240 240;
  --input: 40 40 50;
}
