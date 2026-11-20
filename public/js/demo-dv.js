'use strict';
/* Dhivehi demo data: the same fictional set as js/demo.js, with Maldivian names, island names, complaint summaries,
   respondents, officer notes, panel reasons and recommendations written in Dhivehi. Foreign workers keep their names.
   Enumerated values (stages, outcomes, respondent types, atoll codes, nationalities) stay as they are. */

const DV_NAMES = {
  'Mohamed Rasheed': 'މުޙައްމަދު ރަޝީދު', 'Ahmed Shareef': 'އަޙްމަދު ޝަރީފް', 'Ibrahim Naseem': 'އިބްރާހީމް ނަސީމް', 'Hussain Afeef': 'ޙުސައިން އަފީފް', 'Ali Waheed': 'ޢަލީ ވަޙީދު',
  'Abdulla Faisal': 'ޢަބްދުﷲ ފައިޞަލް', 'Hassan Zahir': 'ޙަސަން ޒާހިރު', 'Ismail Shiham': 'އިސްމާޢީލް ޝިހާމް', 'Moosa Nizar': 'މޫސާ ނިޒާރު', 'Yoosuf Riyaz': 'ޔޫސުފް ރިޔާޒް',
  'Adam Shafeeu': 'އާދަމް ޝަފީޢު', 'Ibrahim Faisal': 'އިބްރާހީމް ފައިޞަލް', 'Mohamed Ziyad': 'މުޙައްމަދު ޒިޔާދު', 'Ahmed Nashid': 'އަޙްމަދު ނާޝިދު', 'Hussain Rasheed': 'ޙުސައިން ރަޝީދު',
  'Ali Shareef': 'ޢަލީ ޝަރީފް', 'Abdul Latheef': 'ޢަބްދުލް ލަޠީފް', 'Hassan Mausoom': 'ޙަސަން މަޢުޞޫމް', 'Mohamed Ihsan': 'މުޙައްމަދު އިޙްސާން', 'Ahmed Rizwan': 'އަޙްމަދު ރިޟްވާން',
  'Aishath Shifa': 'އާއިޝަތު ޝިފާ', 'Fathimath Nuha': 'ފާޠިމަތު ނުހާ', 'Mariyam Zeena': 'މަރިޔަމް ޒީނާ', 'Hawwa Lubna': 'ޙައްވާ ލުބްނާ', 'Aminath Rifa': 'އާމިނަތު ރިފާ',
  'Khadeeja Ahmed': 'ޚަދީޖާ އަޙްމަދު', 'Aishath Shaheema': 'އާއިޝަތު ޝަހީމާ', 'Fathimath Shiuna': 'ފާޠިމަތު ޝިއުނާ', 'Mariyam Visam': 'މަރިޔަމް ވިސާމް', 'Hawwa Nazima': 'ޙައްވާ ނާޒިމާ',
  'Aminath Shiyama': 'އާމިނަތު ޝިޔާމާ', 'Zulaikha Moosa': 'ޒުލައިޚާ މޫސާ', 'Shaufa Ibrahim': 'ޝައުފާ އިބްރާހީމް', 'Raheema Ali': 'ރަޙީމާ ޢަލީ', 'Nashida Hassan': 'ނާޝިދާ ޙަސަން',
  'Fathimath Raufa': 'ފާޠިމަތު ރަޢުފާ', 'Aishath Nisha': 'އާއިޝަތު ނިޝާ', 'Mariyam Saleem': 'މަރިޔަމް ސަލީމް', 'Hafsa Rasheed': 'ޙަފްޞާ ރަޝީދު', 'Asma Adam': 'އަސްމާ އާދަމް',
  'Ahmed Ayaan': 'އަޙްމަދު އަޔާން', 'Aisha Zara': 'އައިޝާ ޒާރާ', 'Mohamed Ilham': 'މުޙައްމަދު އިލްހާމް', 'Fathimath Inaya': 'ފާޠިމަތު އިނާޔާ', 'Ibrahim Aiman': 'އިބްރާހީމް އައިމަން', 'Mariyam Alya': 'މަރިޔަމް އަލްޔާ',
};
const DV_ISLANDS = {
  'Malé': 'މާލެ', 'Hulhumalé': 'ހުޅުމާލެ', 'Vilimalé': 'ވިލިމާލެ', 'Maafushi': 'މާފުށި', 'Thulusdhoo': 'ތުލުސްދޫ', 'Hithadhoo': 'ހިތަދޫ', 'Feydhoo': 'ފޭދޫ', 'Thinadhoo': 'ތިނަދޫ',
  'Fuvahmulah': 'ފުވައްމުލައް', 'Kulhudhuffushi': 'ކުޅުދުއްފުށި', 'Fonadhoo': 'ފޮނަދޫ', 'Naifaru': 'ނައިފަރު', 'Ungoofaaru': 'އުނގޫފާރު', 'Eydhafushi': 'އޭދަފުށި', 'Velidhoo': 'ވެލިދޫ',
  'Rasdhoo': 'ރަސްދޫ', 'Veymandoo': 'ވޭމަންޑޫ', 'Kudahuvadhoo': 'ކުޑަހުވަދޫ', 'Villingili': 'ވިލިނގިލި', 'Dhidhdhoo': 'ދިއްދޫ', 'Nilandhoo': 'ނިލަންދޫ', 'Funadhoo': 'ފުނަދޫ',
  'Mahibadhoo': 'މަހިބަދޫ', 'Muli': 'މުލި',
};
// Complaint summaries, in the same order as DEMO_SCEN.
const DV_SUMMARIES = [
  'ރޭގަނޑު ހައްޔަރުކޮށް، ސަބަބު ނުބުނެ 48 ގަޑިއިރު ވަންދެން ބަހައްޓައި، އާއިލާއާއި ވަކީލަކާ ގުޅުމުގެ ފުރުޞަތު ނުދިން ކަމަށް ބުނެއެވެ.',
  'އެކަމަނާގެ ދަރިފުޅު 14 މަހަށްވުރެ ގިނަ ދުވަހު ޝަރީޢަތް ނިމެންދެން ބަންދުގައި ބަހައްޓާފައިވާއިރު، ޝަރީޢަތުގެ އަޑުއެހުން ހަ ފަހަރު ފަސްކޮށްފައިވާ ކަމަށް ބުނެއެވެ.',
  'އޭނާ ބަންދުކޮށްފައިވާ ބްލޮކުގައި 20 މީހުންނަށް އެއް ފާޚާނާ ބޭނުންކުރަން ޖެހޭ ކަމަށާއި، ރޭގަނޑު ބޯފެން ނުދޭ ކަމަށް ބުނެ، ޒިޔާރަތެއް ކުރުމަށް އެދެއެވެ.',
  'ކޮޓަރި ބަލަމުން ދިޔަ ވަގުތު އޮފިސަރުން ބަންދުގައި ތިބި މީހަކަށް ތަޅައި، ފަހުން ޑޮކްޓަރަކަށް ދެއްކުމުގެ ފުރުޞަތު ނުދިން ކަމަށް ބުނެއެވެ.',
  'ހަކުރުބަލި ޖެހިފައިވާ ބަންދުގައި ތިބި މީހަކަށް ތަފާތު ދުވަސްތަކެއް ވަންދެން އިންސިއުލިން ނުދީ ހިފަހައްޓާފައިވާ ކަމަށް ބުނެ، ޑޮކްޓަރަކަށް ދައްކަން އެދެއެވެ.',
  'ތިން މަހުގެ މުސާރަ ނުދީ ހުރި ކަމަށާއި، މަސައްކަތު ދޭ ފަރާތުން އޭނާގެ ޕާސްޕޯޓް ހިފަހައްޓައިގެން ހުރި ކަމަށް އިމާރާތްކުރުމުގެ މަސައްކަތްތެރިއަކު ބުނެއެވެ.',
  'މަސައްކަތު ދޭ ފަރާތުން ޕާސްޕޯޓް އަނބުރާ ނުދޭތީ ވަޒީފާ ބަދަލުކުރެވޭނެ ގޮތެއް ނެތް ކަމަށާއި، މަންމަގެ ޖަނާޒާއަށް ގައުމަށް ދެވޭނެ ގޮތެއްވެސް ނެތް ކަމަށް ރިސޯޓެއްގެ މުވައްޒަފަކު ބުނެއެވެ.',
  'ވައި ދައުރުވާނެ ގޮތެއް ނެތް އެއް ކޮޓަރީގައި 14 މީހުން ނިދާ ކަމަށާއި، ފާޚާނާ ހަލާކުވެފައި، ރައްކާތެރި ބޯފެން ނެތް ކަމަށް ބިދޭސީ މަސައްކަތްތެރިން ބުނެއެވެ.',
  'ދުވާލަކު 16 ގަޑިއިރު މަސައްކަތްކުރަން ޖެހޭ ކަމަށާއި، ބަންދު ދުވަހެއް ނުދޭ ކަމަށާއި، މުސާރަ ހިފަހައްޓައި ގެއިން ބޭރަށް ދާން ނުދޭ ކަމަށް ގޭބިސީގެ މަސައްކަތްތެރިއެއް ބުނެއެވެ.',
  'ބަލިވެ އިން ކަމަށް މަސައްކަތު ދޭ ފަރާތަށް އަންގައި ދެ ހަފްތާ ފަހުން ވަޒީފާއިން ވަކިކުރި ކަމަށް ބުނެއެވެ.',
  'ނުދައްކާ ހުރި އިތުރުގަޑީގެ ފައިސާއާ ބެހޭގޮތުން މަސައްކަތްކުރާ ތަނުގެ ބޭރުގައި ކުރި ސުލްޙަވެރި މުޒާހަރާއެއްގައި ބައިވެރިވުމުން ވަޒީފާއިން ވަކިކުރި ކަމަށް ބުނެއެވެ.',
  'ސުޕަވައިޒަރެއްގެ ފަރާތުން ތަކުރާރުކޮށް ޖިންސީ ފުރައްސާރަ ކުރި ކަމަށާއި، މެނޭޖްމަންޓަށް ހުށަހެޅި ޝަކުވާއަށް ފިޔަވަޅެއް ނާޅައި ރޭގަނޑުގެ ޝިފްޓަށް ބަދަލުކުރި ކަމަށް ބުނެއެވެ.',
  'ވޭތުވެދިޔަ އަހަރު ހަފްތާގެ ހަތް ދުވަހުވެސް 12 ގަޑިއިރުގެ ޝިފްޓު ކުރަން ޖެހުނު ނަމަވެސް އިތުރުގަޑީގެ ފައިސާ ނުދޭ ކަމަށް ސެކިއުރިޓީ ގާޑުން ބުނެއެވެ.',
  'ސްކޫލުގައި އެހީތެރިކަން ދޭނެ މުވައްޒަފުން ނެތް ކަމަށް ބުނެ، އޮޓިޒަމް ހުރި ކުއްޖަކު 1 ވަނަ ގްރޭޑަށް ނުބަލައިގަތް ކަމަށް ބެލެނިވެރިއެއް ބުނެއެވެ.',
  'އަންހެން ދަރިފުޅަށް މަސްތަކެއް ވަންދެން ބުލީކުރަމުން އަންނަ ކަމަށާއި، ލިޔުމުން ތިން ޝަކުވާ ހުށަހެޅި ނަމަވެސް ސްކޫލުން ފިޔަވަޅެއް ނާޅާ ކަމަށް ބެލެނިވެރިއެއް ބުނެއެވެ.',
  'ޓީޗަރަކު އަދަބެއްގެ ގޮތުން ރޫލަރުން ދަރިވަރުންތަކަކަށް ތަޅާފައިވާ ކަމަށާއި، އެއް ކުއްޖެއްގެ ހަށިގަނޑުގައި ތަޅުމުގެ ފާހަގަ ފެންނަ ކަމަށް ބުނެއެވެ.',
  'ރަށުގެ ސްކޫލަށް މުޅި ތަޢުލީމީ އަހަރު ވަންދެން ސައިންސް ޓީޗަރެއް ނެތް ކަމަށް ރަށު ކައުންސިލްގެ މެމްބަރަކު ޝަކުވާކުރެއެވެ.',
  'މަސައްކަތު ދޭ ފަރާތުން ޑިޕޮޒިޓެއް ދައްކަންދެން ބިދޭސީ މަސައްކަތްތެރިއަކަށް ޞިއްޙީ މަރުކަޒުން ފަރުވާ ނުދިން ކަމަށް ބުނެއެވެ.',
  'ހޮސްޕިޓަލުން ބަލި ދެނެގަތުމުގައި ކުށެއް ހެދުމުން ބައްޕަގެ އޮޕަރޭޝަން ލަސްވެ ދާއިމީ ގެއްލުމެއް ލިބުނު ކަމަށް އާއިލާއިން ބުނެއެވެ.',
  'ރަށުގައި ނަފްސާނީ ބަލިތަކަށް ފަރުވާ ދެވޭނެ ނިޒާމެއް ނެތުމުން ދަރިފުޅުގެ ޙާލަތު ގޯސްވަމުން ދާ ކަމަށް މަންމައެއް ބުނެއެވެ.',
  'ދަތިތަކެއް ކުރިމަތިވެފައިވާ ބަލިވެ އިން އަންހެނަކަށް އިމަރޖެންސީ މެޑިކަލް އިވެކުއޭޝަން ޚިދުމަތް ލިބުނީ ނުވަ ގަޑިއިރު ފަހުން ކަމަށް ބުނެއެވެ.',
  'ޞިއްޙީ މުވައްޒަފަކު އޭނާގެ އެޗް.އައި.ވީ ޙާލަތު މަސައްކަތު ދޭ ފަރާތަށް ހާމަކުރުމުން ވަޒީފާ ގެއްލުނު ކަމަށް ބުނެއެވެ.',
  'ކުރިން އެންގުމެއް ނެތި ކައުންސިލުން ގެއިން ނެރެ، މުދާ ނަގާފައިވާ ކަމަށް ހަ މީހުންގެ އާއިލާއެއް ބުނެއެވެ.',
  'ހަތަރު އަހަރު ވަންދެން ވެއިޓިންގ ލިސްޓުގައި ހުރުމަށްފަހު ސަބަބެއް ނުބުނެ ގެދޮރުގެ އެޕްލިކޭޝަން ރިޖެކްޓްކުރި ކަމަށް ޝަކުވާކުރެއެވެ.',
  'އާއިލާގެ އެގާރަ މީހުން، ފަންގަސް އަޅައި ސިޔާޖުން ފެން ލީކުވާ ދެ ކޮޓަރީގެ ފްލެޓެއްގައި ދިރިއުޅޭ ކަމަށް ބުނެއެވެ.',
  'ލޮލަށް ނުކުޅެދުންތެރިކަމެއް ހުރި މީހެއްގެ ނުކުޅެދުންތެރިކަމުގެ އެލަވަންސް ފަސް މަސް ކުރިން އެންގުމެއް ނެތި ހުއްޓާލި ކަމަށް ބުނެއެވެ.',
  'ކާނާއާއި ބޭސް ގަތުމަށް ޕެންޝަނުގެ އަދަދު ފުދިގެން ނުދާ ކަމަށް މުސްކުޅި މަސްވެރިއަކު ބުނެ، އެކަން ރިވިއުކުރުމަށް އެދެއެވެ.',
  'ކުލީ އެގްރީމެންޓެއް ނެތީތީ އެހީ ނުދޭ ކަމަށް ތިން ދަރިން ބަލަހައްޓާ އެކަނި މަންމައެއް ބުނެއެވެ.',
  'ސިޔާސަތެއް ފާޑުކިޔައި ސޯޝަލް މީޑިއާގައި ލިޔުމެއް ލިޔުމުން، މަސައްކަތު ދޭ ފަރާތުން ގޮވާލައި އިންޒާރު ދިން ކަމަށް ޓީޗަރަކު ބުނެއެވެ.',
  'ބިން ދިނުމާ ބެހޭ ލިޔުމެއް ޝާއިޢުކުރުމަށްފަހު ފޯނުން އިންޒާރު ލިބެމުން އަންނަ ކަމަށް ނޫސްވެރިއަކު ބުނެއެވެ.',
  'ސްކޫލެއްގެ ބޭރުގައި ސުލްޙަވެރިކޮށް އެއްވެ ތިބި ބެލެނިވެރިން ފުލުހުން ޕެޕަރ ސްޕްރޭ ޖަހައިގެން ފަޅައިލި ކަމަށް ބުނެއެވެ.',
  'ކައުންސިލްގެ މުވައްޒަފަކު އެކަމަނާގެ ޞިއްޙީ މަޢުލޫމާތު އާންމު މެސެޖިންގ ގްރޫޕެއްގައި ހިއްސާކުރި ކަމަށް ބުނެއެވެ.',
  'ދަރިން ދެކުމަށް ކޯޓުން ޙުކުމްކޮށްފައިވީ ނަމަވެސް އަށް މަސް ވަންދެން ދަރިން ދެކެން ނުދޭ ކަމަށް ބައްޕައެއް ބުނެއެވެ.',
  'ރަށު ކައުންސިލް އިދާރާއާއި ކޯޓު ބިލްޑިންގަށް ވަދެވޭނެ ރެމްޕެއް ނުވަތަ ފަސޭހަ ދޮރެއް ނެތް ކަމަށް ވީލްޗެއާ ބޭނުންކުރާ މީހަކު ބުނެއެވެ.',
  'ސަރުކާރު ކައުންޓަރަކުން ބަންގާޅީ މަސައްކަތްތެރިއަކަށް ޚިދުމަތް ނުދީ، ދިވެހި ސްޕޮންސަރަކާ އެކު އަންނަން ބުނި ކަމަށް ބުނެއެވެ.',
  'މަރުވެފައިވާ ފިރިމީހާގެ ބިމާ ބެހޭ މައްސަލައެއް ހުށަހަޅަން ދެ އަހަރު ވަންދެން މަސައްކަތްކުރި ނަމަވެސް އެއް އޮފީހުން އަނެއް އޮފީހަށް ފޮނުވަމުން ދާ ކަމަށް ބުނެއެވެ.',
  'ރަށުގެ ފެން ހަދާ ޕްލާންޓް ތިން ހަފްތާ ވަންދެން ހަލާކުވެފައި ހުރުމުން ގޭބިސީތަކުން ފުޅި ފެން ގަންނަން ޖެހިފައިވާ ކަމަށް ރައްޔިތުން ބުނެއެވެ.',
  'ގޭގެ ކައިރީގައި ކުނި އަންދާތީ ދުން އަރައި ކުޑަކުދިންނަށް ނޭވާލުމުގެ ދަތިތައް ކުރިމަތިވާ ކަމަށް ރައްޔިތުން ޝަކުވާކުރެއެވެ.',
  'ގޮނޑުދޮށް ކެނޑުމުން ބަދަލުކުރި އާއިލާތަކަށް ވަޢުދުވި ގެދޮރު އަހަރެއް ވީއިރުވެސް ނުދޭ ކަމަށް ބުނެއެވެ.',
  'ސްކޫލު ގަޑީގައި 13 އަހަރުގެ ކުއްޖަކު މަސްދޯންޏެއްގައި މަސައްކަތްކުރާ ކަމަށް ބުނެއެވެ.',
  'ފުލުހުންގެ ބެލުމުގެ ދަށަށް ގެންދަމުން ދިޔަ ވަގުތު އޮފިސަރުން ތަޅައި ފައިން ޖެހި، ބުރަކަށީގައި ހަނި އެޅިފައިވާ ކަމަށް ބުނެއެވެ.',
  'ކޮޓަރީގައި ތިބެން ޖެހޭ ޢަދަދުގެ ދެގުނަ މީހުން ތިބޭ ކަމަށާއި، ފަންކާއެއް ނެތް ކަމަށާއި، ބޯފެން ދެނީ ދުވާލަކު ދެ ފަހަރު ކަމަށް ބަންދުގައި ތިބި މީހަކު ބުނެއެވެ.',
  'ޑިޕޯޓްކުރާނީ ކޮން އިރަކުކަން ނުބުނެ ފަސް މަސް ވަންދެން އިމިގްރޭޝަން ޑިޓެންޝަން ސެންޓަރުގައި ބަހައްޓާފައިވާ ކަމަށް ބިދޭސީ މަސައްކަތްތެރިއަކު ބުނެއެވެ.',
  'ތަކުރާރުކޮށް އެދުނު ނަމަވެސް މޭގައި ހުންނަ ތަދަކަށް ސްޕެޝަލިސްޓަކަށް ރިފަރކުރުމަށް ހަތަރު މަސް ވަންދެން މަޑުކުރަން ޖެހިފައިވާ ކަމަށް ޖަލުގައި ތިބި މީހަކު ބުނެއެވެ.',
  'ދަރިފުޅު 30 ދުވަހަށްވުރެ ގިނަ ދުވަހު ވަކިން ބަހައްޓާ ކޮޓަރިއެއްގައި ބަހައްޓައި، އާއިލާއަށް ބައްދަލުކުރަން ނުދޭ ކަމަށް އާއިލާއިން ބުނެއެވެ.',
  'ބަދަލުކުރުމަށްފަހު ވަކީލާ ވަކިން ބައްދަލުކުރަން ނުދޭ ކަމަށް ޝަރީޢަތް ނިމެންދެން ބަންދުގައި ތިބި މީހަކު ބުނެއެވެ.',
  'ޖުވެނައިލް ސެންޓަރުގައި ބަންދުކޮށްފައިވާ 16 އަހަރުގެ ކުއްޖަކަށް އުމުރުން ބޮޑު ކުދިން ހަމަލާދިން ކަމަށާއި، މުވައްޒަފުން ނުހުއްޓުވި ކަމަށް ބުނެއެވެ.',
  'މަސްތުވާތަކެތީގެ ރިހެބިލިޓޭޝަން ސެންޓަރުގައި ތިބި މީހަކު، އަދަބެއްގެ ގޮތުން ދެ ދުވަހު ކޮޓަރިއެއްގައި ބަނދެ ތަޅުލި ކަމަށް ބުނެއެވެ.',
  'ޚާއްޞަ އެހީތެރިކަން ބޭނުންވާ މީހުންގެ ގޭގައި ތިބި މީހަކަށް އަބަދުވެސް ނިދާ ބޭސް ދީގެން ބަހައްޓާ ކަމަށާއި، ތެރަޕީއެއް ނުވަތަ ހަރަކާތެއް ނެތް ކަމަށް އޭނާގެ ގާތްތިމާގެ މީހަކު ބުނެއެވެ.',
  'ދައުލަތުގެ ކުޑަކުދިންގެ ގޭގައި ދިރިއުޅޭ އަންހެން ކުއްޖަކު ސްކޫލަށް ނުފޮނުވާ ކަމަށާއި، އުމުރުން ބޮޑު ކުދިން ބުލީކުރާ ކަމަށް ބުނެއެވެ.',
  'ހިތުގެ ބޭސް ދިނުމަށް އެދުނު ނަމަވެސް ފުލުހުންގެ ބެލުމުގެ ދަށުގައި ބައްޕަ މަރުވި މައްސަލަ ތަޙުޤީޤުކުރުމަށް އާއިލާއިން އެދެއެވެ.',
  'ރޭގަނޑުގެ ޝިފްޓުގައި އަންހެނުންގެ ސެކްޝަނުގައި އަންހެން އޮފިސަރެއް ނެތް ކަމަށާއި، ފެންވަރާއިރު ސިއްރު ނުވާ ކަމަށް އަންހެން ބަންދީއެއް ބުނެއެވެ.',
];
const DV_RESPONDENTS = {
  'A police station': 'ފުލުހުންގެ ސްޓޭޝަނެއް', 'A remand centre': 'ރިމާންޑް ސެންޓަރެއް', 'A detention facility': 'ބަންދުކުރާ ތަނެއް', 'A construction company': 'އިމާރާތްކުރާ ކުންފުންޏެއް',
  'A resort operator': 'ރިސޯޓެއް ހިންގާ ފަރާތެއް', 'A private household': 'ގޭބިސީއެއް', 'A retail company': 'ވިޔަފާރި ކުންފުންޏެއް', 'A fishing company': 'މަސްވެރިކަމުގެ ކުންފުންޏެއް',
  'A security services company': 'ސެކިއުރިޓީ ޚިދުމަތުގެ ކުންފުންޏެއް', 'A primary school': 'ޕްރައިމަރީ ސްކޫލެއް', 'A secondary school': 'ސެކަންޑަރީ ސްކޫލެއް', 'A school on the island': 'ރަށުގެ ސްކޫލް',
  'A regional health centre': 'ސަރަޙައްދީ ޞިއްޙީ މަރުކަޒެއް', 'A regional hospital': 'ސަރަޙައްދީ ހޮސްޕިޓަލެއް', 'An island health centre': 'ރަށު ޞިއްޙީ މަރުކަޒެއް', 'A health authority': 'ޞިއްޙީ އޮތޯރިޓީ',
  'A health centre': 'ޞިއްޙީ މަރުކަޒެއް', 'A city council': 'ސިޓީ ކައުންސިލެއް', 'A housing authority': 'ހައުސިންގ އޮތޯރިޓީ', 'A social protection agency': 'ސޯޝަލް ޕްރޮޓެކްޝަން އެޖެންސީ',
  'A pension administration': 'ޕެންޝަން އިދާރާ', 'A government ministry': 'ސަރުކާރުގެ ވުޒާރާއެއް', 'Unknown persons': 'ނޭނގޭ ފަރާތްތައް', 'Police': 'ފުލުހުން',
  'A family protection authority': 'ފެމިލީ ޕްރޮޓެކްޝަން އޮތޯރިޓީ', 'An island council': 'ރަށު ކައުންސިލެއް', 'A government office': 'ސަރުކާރު އޮފީހެއް', 'A land registry office': 'ބިމުގެ ރަޖިސްޓްރީ އޮފީސް',
  'A utility company': 'ޔުޓިލިޓީ ކުންފުންޏެއް', 'A fishing vessel owner': 'މަސްދޯނީގެ ވެރިއެއް', 'A police custodial facility': 'ފުލުހުންގެ ބަންދުކުރާ ތަނެއް',
  'An immigration detention centre': 'އިމިގްރޭޝަން ޑިޓެންޝަން ސެންޓަރު', 'A prison': 'ޖަލެއް', 'A juvenile detention centre': 'ޖުވެނައިލް ޑިޓެންޝަން ސެންޓަރު',
  'A drug rehabilitation centre': 'މަސްތުވާތަކެތީގެ ރިހެބިލިޓޭޝަން ސެންޓަރު', 'A State care home': 'ދައުލަތުގެ ބެލުމުގެ ދަށުގައިވާ ގެއެއް', 'Workers’ accommodation': 'މަސައްކަތްތެރިންގެ ދިރިއުޅޭ ތަން',
};
// Free-text notes, reasons and recommendations used by the demo generator.
const DV_TEXT = {
  'Adopt a written procedure ensuring every detainee can contact family and a lawyer within 24 hours of arrest.': 'ހައްޔަރުކުރާ ކޮންމެ މީހަކަށް 24 ގަޑިއިރުގެ ތެރޭގައި އާއިލާއާއި ވަކީލަކާ ގުޅުމުގެ ފުރުޞަތު ދިނުމަށް ލިޔުމުން އުޞޫލެއް ހެދުން.',
  'Apologise to the complainant and correct the record.': 'ޝަކުވާ ހުށަހެޅި ފަރާތުން މާފަށް އެދި، ރިކޯޑު ރަނގަޅުކުރުން.',
  'Check documents and contact the complainant.': 'ލިޔެކިޔުންތައް ބަލައި ޝަކުވާ ހުށަހެޅި ފަރާތާ ގުޅުން.',
  'Check whether there are other complaints against the same respondent.': 'އެއް ފަރާތާ ދެކޮޅަށް އެހެން ޝަކުވާތައް ހުރިތޯ ބެލުން.',
  'Clarification obtained and attached to the review notes.': 'ވުޒާހަތު ހޯދައި ރިވިއު ނޯޓްސްއާ ގުޅާލެވިއްޖެ.',
  'Clarification obtained.': 'ވުޒާހަތު ހޯދިއްޖެ.',
  'Clarify the dates of the incident.': 'ހާދިސާ ހިނގި ތާރީޚުތައް ވުޒާހަތުކުރުން.',
  'Clarify whether the matter is before a court.': 'މައްސަލަ ކޯޓެއްގައި ހުރިތޯ ވުޒާހަތުކުރުން.',
  'Closed by the Commission; matter overtaken by events.': 'ޙާލަތު ބަދަލުވެފައިވާތީ ކޮމިޝަނުން މައްސަލަ ނިންމާލެވިއްޖެ.',
  'Commission meeting room (demo)': 'ކޮމިޝަނުގެ ބައްދަލުވުންތަކުގެ ކޮޓަރި (ޑެމޯ)',
  'Complainant contacted by phone; respondent contacted in writing.': 'ޝަކުވާ ހުށަހެޅި ފަރާތާ ފޯނުން ގުޅައި، ޝަކުވާ ކުރެވޭ ފަރާތާ ލިޔުމުން ގުޅިއްޖެ.',
  'Complaint form and ID copy checked.': 'ޝަކުވާ ފޯމާއި ކާޑުގެ ކޮޕީ ބަލައިފިން.',
  'Confirm the exact dates of the incident.': 'ހާދިސާ ހިނގި ސީދާ ތާރީޚުތައް ކަށަވަރުކުރުން.',
  'Confirm whether the complainant consents to the complaint being lodged.': 'ޝަކުވާ ލޮޖްކުރުމަށް ޝަކުވާ ހުށަހެޅި ފަރާތުގެ ރުހުން ހުރިތޯ ކަށަވަރުކުރުން.',
  'Confirmation of the dates and the decision taken, with reasons.': 'ތާރީޚުތަކާއި ނިންމި ނިންމުން، ސަބަބުތަކާއެކު ކަށަވަރުކުރުން.',
  'Contact the respondent institution for its records before the panel.': 'ޕެނަލަށް ހުށަހެޅުމުގެ ކުރިން ރެކޯޑްތައް ހޯދުމަށް ޝަކުވާ ކުރެވޭ މުއައްސަސާއާ ގުޅުން.',
  'Copies of the relevant records and a written explanation.': 'ގުޅުންހުރި ރެކޯޑްތަކުގެ ކޮޕީއާއި ލިޔުމުން ވުޒާހަތެއް.',
  'Decide whether further information is needed.': 'އިތުރު މަޢުލޫމާތު ބޭނުންތޯ ނިންމުން.',
  'Decide whether to proceed and how.': 'ކުރިއަށް ދާނަމަ، ކޮން ގޮތަކަށްތޯ ނިންމުން.',
  'Decide whether to refer to the Investigation Department.': 'ތަޙުޤީޤު ޑިޕާޓްމަންޓަށް ފޮނުވާނެތޯ ނިންމުން.',
  'Ensure the child attends school and is not employed during school hours.': 'ކުއްޖާ ސްކޫލަށް ދާކަން ކަށަވަރުކޮށް، ސްކޫލު ގަޑީގައި މަސައްކަތުގައި ނުބޭނުންކުރުން.',
  'Establish whether the matter is already before a court.': 'މައްސަލަ މިހާރުވެސް ކޯޓެއްގައި ހުރިތޯ ބެލުން.',
  'Exact date of the incident to be confirmed.': 'ހާދިސާ ހިނގި ސީދާ ތާރީޚު ކަށަވަރުކުރަން ޖެހޭ.',
  'Facts are partly disputed by the respondent; recommend the panel considers further inquiry.': 'ހަގީގަތްތަކުގެ ބައެއް ކަންކަމާ ޝަކުވާ ކުރެވޭ ފަރާތުން ދެކޮޅުހަދައެވެ. އިތުރު ތަޙުޤީޤަކަށް ޕެނަލުން ވިސްނުމަށް ލަފާދެމެވެ.',
  'Facts as alleged may engage this provision; to be assessed by the panel.': 'ދަޢުވާކުރާ ހަގީގަތްތައް މި މާއްދާއާ ގުޅެން ދާނެއެވެ. ޕެނަލުން ބަލަން ޖެހޭ.',
  'Findings shared; recommendations sent to the respondent institution.': 'ފާހަގަކުރެވުނު ކަންކަން ހިއްސާކޮށް، ޝަކުވާ ކުރެވޭ މުއައްސަސާއަށް ރެކޮމެންޑޭޝަންތައް ފޮނުވިއްޖެ.',
  'Institution acknowledged the recommendation in writing.': 'މުއައްސަސާއިން ރެކޮމެންޑޭޝަން ލިބުނުކަން ލިޔުމުން އަންގައިފި.',
  'Institution confirmed implementation; evidence received.': 'ތަންފީޒުކުރިކަން މުއައްސަސާއިން ކަށަވަރުކޮށް، ހެކި ލިބިއްޖެ.',
  'Institution did not respond after two reminders.': 'ދެ ފަހަރު ހަނދާންކޮށްދިނުމަށްފަހުވެސް މުއައްސަސާއިން ޖަވާބެއް ނުދޭ.',
  'Institution reports that implementation has started.': 'ތަންފީޒުކުރަން ފަށައިފި ކަމަށް މުއައްސަސާއިން ބުނެއެވެ.',
  'Insufficient grounds to investigate at this stage.': 'މި މަރުޙަލާގައި ތަޙުޤީޤުކުރުމަށް ފުދޭ ސަބަބެއް ނެތް.',
  'Interview the complainant in person.': 'ޝަކުވާ ހުށަހެޅި ފަރާތާ ސީދާ ބައްދަލުކޮށް ސުވާލުކުރުން.',
  'Introduce an anti-bullying policy with a clear reporting and response procedure.': 'ބުލީކުރުން ހުއްޓުވުމަށް، ރިޕޯޓުކުރުމާއި ފިޔަވަޅު އެޅުމުގެ ސާފު އުޞޫލަކާއެކު ސިޔާސަތެއް ތައާރަފުކުރުން.',
  'Investigation completed; report attached to the investigation file.': 'ތަޙުޤީޤު ނިމި، ރިޕޯޓް ތަޙުޤީޤު ފައިލާ ގުޅާލެވިއްޖެ.',
  'More information is needed before deciding whether to lodge.': 'ލޮޖްކުރާނެތޯ ނިންމުމުގެ ކުރިން އިތުރު މަޢުލޫމާތު ބޭނުންވޭ.',
  'No answer; will follow up.': 'ޖަވާބެއް ނުލިބޭ. ފޮލޯއަޕް ކުރާނަން.',
  'Obtain a written statement from the complainant.': 'ޝަކުވާ ހުށަހެޅި ފަރާތުން ލިޔުމުން ބަޔާނެއް ހޯދުން.',
  'Obtain records from the respondent.': 'ޝަކުވާ ކުރެވޭ ފަރާތުން ރެކޯޑްތައް ހޯދުން.',
  'Obtain the respondent’s records.': 'ޝަކުވާ ކުރެވޭ ފަރާތުގެ ރެކޯޑްތައް ހޯދުން.',
  'Obtain the respondent’s version.': 'ޝަކުވާ ކުރެވޭ ފަރާތުގެ ބަސް ހޯދުން.',
  'Obtain the respondent’s written response.': 'ޝަކުވާ ކުރެވޭ ފަރާތުގެ ލިޔުމުން ޖަވާބު ހޯދުން.',
  'Part of the recommendation has been implemented; follow-up continues.': 'ރެކޮމެންޑޭޝަނުގެ ބައެއް ތަންފީޒުކޮށްފި. ފޮލޯއަޕް ކުރިއަށް ދަނީ.',
  'Pay the outstanding wages to the complainant within 30 days.': 'ޝަކުވާ ހުށަހެޅި ފަރާތަށް ދައްކަން ހުރި މުސާރަ 30 ދުވަހުގެ ތެރޭގައި ދެއްކުން.',
  'Please prioritise; the allegations are serious.': 'ތުހުމަތުތަކަކީ ބޮޑެތި ތުހުމަތުތަކެއް ކަމުން މި މައްސަލައަށް އިސްކަން ދެއްވާ.',
  'Policy document received.': 'ސިޔާސަތުގެ ލިޔުން ލިބިއްޖެ.',
  'Prepare a waste management plan that ends open burning near homes.': 'ގޭގެ ކައިރީގައި ކުނި އެންދުން ހުއްޓުވޭނެ ކުނި މެނޭޖްކުރުމުގެ ޕްލޭނެއް ތައްޔާރުކުރުން.',
  'Priority case; establish dates and the institution involved.': 'އިސްކަން ދޭންޖެހޭ މައްސަލައެއް. ތާރީޚުތަކާއި ގުޅުންހުރި މުއައްސަސާ ކަނޑައަޅާ.',
  'Provide the complainant with access to the required medical treatment.': 'ޝަކުވާ ހުށަހެޅި ފަރާތަށް ބޭނުންވާ ފަރުވާ ލިބޭނެ ގޮތް ހަމަޖެއްސުން.',
  'Publish the criteria and waiting list for social housing and give written reasons for every rejection.': 'ސޯޝަލް ހައުސިންގެ ޝަރުތުތަކާއި ވެއިޓިންގ ލިސްޓު ޝާއިޢުކޮށް، ކޮންމެ ރިޖެކްޝަނަކަށް ލިޔުމުން ސަބަބު ދިނުން.',
  'Records received; they confirm the dates.': 'ރެކޯޑްތައް ލިބިއްޖެ. ތާރީޚުތައް ކަށަވަރުވޭ.',
  'Reinstate the complainant or pay compensation as required by the Employment Act.': 'ވަޒީފާއާ ބެހޭ ޤާނޫނުގައިވާ ގޮތުގެ މަތިން ޝަކުވާ ހުށަހެޅި ފަރާތް ވަޒީފާއަށް އަނބުރާ ނެގުން ނުވަތަ ގެއްލުމުގެ ބަދަލު ދިނުން.',
  'Reminder sent.': 'ހަނދާންކޮށްދިނުމުގެ ސިޓީ ފޮނުވިއްޖެ.',
  'Request the relevant policy document.': 'ގުޅުންހުރި ސިޔާސަތުގެ ލިޔުން ހޯދުން.',
  'Respondent has not yet replied in full.': 'ޝަކުވާ ކުރެވޭ ފަރާތުން އަދި ފުރިހަމަ ޖަވާބެއް ނުދޭ.',
  'Restore the water supply and inform residents of the timeline.': 'ފެން ސަޕްލައި އަލުން ފެށުމާއި، ރައްޔިތުންނަށް ވަގުތު ތާވަލު އެންގުން.',
  'Return the complainant’s passport immediately.': 'ޝަކުވާ ހުށަހެޅި ފަރާތުގެ ޕާސްޕޯޓް ވަގުތުން އަނބުރާ ދިނުން.',
  'Review the complainant’s application and give written reasons for the decision.': 'ޝަކުވާ ހުށަހެޅި ފަރާތުގެ އެޕްލިކޭޝަން ރިވިއުކޮށް، ނިންމުމުގެ ސަބަބު ލިޔުމުން ދިނުން.',
  'Spoke to the focal point; reply promised this week.': 'ފޯކަލް ޕޮއިންޓާ ވާހަކަދެއްކިން. މި ހަފްތާގައި ޖަވާބު ދޭނެ ކަމަށް ބުނެފި.',
  'Stop holding workers’ passports and introduce a policy that workers keep their own documents.': 'މަސައްކަތްތެރިންގެ ޕާސްޕޯޓް ހިފެހެއްޓުން ހުއްޓާލައި، ލިޔެކިޔުން މަސައްކަތްތެރިން ގާތުގައި ބެހެއްޓުމުގެ ސިޔާސަތެއް ތައާރަފުކުރުން.',
  'Stop requiring deposits from migrant workers before emergency treatment.': 'ކުއްލި ފަރުވާ ދިނުމުގެ ކުރިން ބިދޭސީ މަސައްކަތްތެރިންގެ ކިބައިން ޑިޕޮޒިޓް ހޯދުން ހުއްޓާލުން.',
  'Supporting documents are consistent with the complaint.': 'ހުށަހެޅި ލިޔެކިޔުންތައް ޝަކުވާއާ ދިމާވޭ.',
  'The complaint falls outside the Commission’s mandate.': 'ޝަކުވާއަކީ ކޮމިޝަނުގެ އިޚްތިޞާޞާ ބޭރުގެ ކަމެއް.',
  'The complaint falls within the mandate and should be considered by the panel.': 'ޝަކުވާއަކީ ކޮމިޝަނުގެ އިޚްތިޞާޞްގެ ތެރޭގައިވާ ކަމެއް ކަމުން ޕެނަލުން ބަލަން ޖެހޭ.',
  'The complaint falls within the mandate and the facts warrant investigation.': 'ޝަކުވާއަކީ ކޮމިޝަނުގެ އިޚްތިޞާޞްގެ ތެރޭގައިވާ ކަމެއް ކަމަށާއި، ހަގީގަތްތަކުން ތަޙުޤީޤަކަށް ބޭނުންވާ ކަމަށް ފެނޭ.',
  'The facts disclose a possible violation that the Commission wishes to investigate.': 'ހަގީގަތްތަކުން ހައްޤެއް ގެއްލިފައިވާ ކަމަށް ފެންނާތީ، ކޮމިޝަނުން ތަޙުޤީޤުކުރަން ބޭނުންވޭ.',
  'The matter raises a systemic issue the Commission wants investigated.': 'މައްސަލައިގައި ނިޒާމީ މައްސަލައެއް ހިމެނޭތީ ކޮމިޝަނުން ތަޙުޤީޤުކުރަން ބޭނުންވޭ.',
  'The panel needs clarification before deciding whether to lodge.': 'ލޮޖްކުރާނެތޯ ނިންމުމުގެ ކުރިން ޕެނަލަށް ވުޒާހަތު ބޭނުންވޭ.',
  'The policy or procedure applied in this case.': 'މި މައްސަލައިގައި ތަންފީޒުކުރި ސިޔާސަތު ނުވަތަ އުޞޫލު.',
  'Written explanation received; disputes part of the complaint.': 'ލިޔުމުން ވުޒާހަތު ލިބިއްޖެ. ޝަކުވާގެ ބައެއް ކަންކަމާ ދެކޮޅުހަދައެވެ.',
  'Acknowledgement of complaint': 'ޝަކުވާ ލިބުނުކަމުގެ ސިޓީ',
  'verify the facts and identify those responsible': 'ހަގީގަތްތައް ކަށަވަރުކޮށް ޒިންމާވާ ފަރާތްތައް ދެނެގަތުން',
  'establish whether the conduct occurred and recommend remedial action': 'ޢަމަލު ހިނގިތޯ ބަލައި ރަނގަޅުކުރުމުގެ ފިޔަވަޅު ލަފާދިނުން',
  'inspect the premises and interview the persons concerned': 'ތަން ބަލައި ގުޅުންހުރި ފަރާތްތަކާ ސުވާލުކުރުން',
  // pieces of the "not lodged" panel reasons (the reason field itself keeps its English value, which the app uses as a category)
  'The complainant is to be informed in writing.': 'ޝަކުވާ ހުށަހެޅި ފަރާތަށް ލިޔުމުން އަންގަންވާނެ.',
  "Outside the Commission's mandate": 'ކޮމިޝަނުގެ އިޚްތިޞާޞާ ބޭރު', 'Insufficient information after clarification': 'ވުޒާހަތު ހޯދުމަށްފަހުވެސް މަޢުލޫމާތު ފުދިގެން ނުދޭ',
  'Complaint withdrawn by the complainant': 'ޝަކުވާ ހުށަހެޅި ފަރާތުން ޝަކުވާ ނަގާލައިފި', 'Matter already before a court': 'މައްސަލަ މިހާރުވެސް ކޯޓެއްގައި ހުރި',
  'Resolved between the parties': 'ފަރާތްތަކުގެ މެދުގައި ހައްލުވެއްޖެ', 'Duplicate of another complaint': 'އެހެން ޝަކުވާއެއްގެ ތަކުރާރެއް',
};
// Keys whose values are free text and may be translated; everything else (ids, enums, dates) is left alone.
const DV_SKIP_KEYS = new Set(['id', 'stage', 'status', 'outcome', 'type', 'kind', 'rtype', 'channel', 'atoll', 'nationality', 'sex', 'rel', 'role', 'roles', 'by', 'to', 'owner', 'ownerDept', 'dept', 'recipient', 'lawId', 'meetingId', 'decisionId', 'regNo', 'cmsRef', 'catId', 'subId', 'issueId', 'groups', 'topics', 'secondary', 'facility', 'preferred', 'who', 'reason', 'nlReason']);
const DV_PHRASES = Object.entries(DV_TEXT).sort((a, b) => b[0].length - a[0].length);
function dvString(key, v, ctx) {
  if (key === 'name' && DV_NAMES[v]) return DV_NAMES[v];
  if (key === 'island' && DV_ISLANDS[v]) return DV_ISLANDS[v];
  if (key === 'summary' && ctx.summary) return ctx.summary;
  if (key === 'name' && ctx.inRespondent && DV_RESPONDENTS[v]) return DV_RESPONDENTS[v];
  if (DV_TEXT[v]) return DV_TEXT[v];
  if (v.length > 12) for (const [en, dv] of DV_PHRASES) if (v.includes(en)) v = v.split(en).join(dv);
  return v;
}
function dvWalk(o, ctx, key) {
  if (Array.isArray(o)) return key && DV_SKIP_KEYS.has(key) ? o : o.map(x => dvWalk(x, ctx, ''));
  if (o && typeof o === 'object') { const out = {}; for (const [k, v] of Object.entries(o)) out[k] = k === 'to' && typeof v === 'string' && DV_RESPONDENTS[v] ? DV_RESPONDENTS[v] : DV_SKIP_KEYS.has(k) && typeof v !== 'object' ? v : dvWalk(v, { ...ctx, inRespondent: k === 'respondent' || ctx.inRespondent }, k); return out; }
  return typeof o === 'string' ? dvString(key, o, ctx) : o;
}
// Turn a buildDemo() result into Dhivehi.
function dvifyDemo(data) {
  const sumByEn = new Map(DEMO_SCEN.map((s, i) => [s[2], DV_SUMMARIES[i]]).filter(x => x[1]));
  const fix = doc => dvWalk(doc, { summary: sumByEn.get(doc.summary) || null }, '');
  return {
    ...data,
    complainants: Object.fromEntries(Object.entries(data.complainants).map(([id, d]) => [id, fix(d)])),
    victims: Object.fromEntries(Object.entries(data.victims).map(([id, d]) => [id, fix(d)])),
    complaints: data.complaints.map(([id, d]) => [id, fix(d)]),
    meetings: data.meetings.map(([id, d]) => [id, fix(d)]),
    recs: data.recs.map(([id, d]) => [id, fix(d)]),
  };
}
