/**
 * Gala S3 du 8 octobre 2026, couru dans PCM26 : classement visible sur les captures
 * « Résultats poule 1.png » et « résultats.png » fournies par l'organisateur.
 * Les captures établissent les 20 premières places de chaque poule, pas le classement intégral.
 * Les équipes et la répartition des inscrits proviennent du manifest des startlists du 8 octobre.
 * UUID stables : snapshot PCM « complete-champions-20261006 », par pcm_export_id.
 * Aucun classement du circuit, point, argent ou effet de simulation n'est modifié ici.
 */
export const SEASON_FINALE_GALA_RESULTS_EDITION = "gala-s3-20261008" as const;
export const SEASON_FINALE_GALA_RESULTS_EVENT_ID = "e7118cbc-a14a-43d9-a292-4486a910de0d";
// Vidéos publiques vérifiées dans YouTube Studio, chaîne Cyclo Stratège, le 8 octobre 2026.
export const SEASON_FINALE_GALA_RESULTS_VIDEO_IDS = { 1: "tuP7RV3wkLM", 2: "oxUyuBcQ5aI" } as const;

export type SeasonFinaleGalaResultRow = {
  rank: number;
  riderId: string;
  teamId: string;
  riderName: string;
  teamName: string;
  gapSeconds: number;
};

export type SeasonFinaleGalaResultsGroup = {
  groupNumber: number;
  label: string;
  winnerTime: string;
  rows: readonly SeasonFinaleGalaResultRow[];
  teams: readonly { teamId: string; teamName: string }[];
};

export const SEASON_FINALE_GALA_RESULTS = [
  {
    groupNumber: 1,
    label: "Poule 1",
    winnerTime: "4h23′16″",
    rows: [
      {"rank":1,"riderId":"43d8cfba-7e4f-4066-9695-853b7e270dbc","teamId":"f2e292c0-0c9e-41a2-8cd8-ed2a6bf83b57","riderName":"Zain Miah","teamName":"Abbaye du Lion","gapSeconds":0},
      {"rank":2,"riderId":"d767816e-08ea-415b-9be0-38004a0160f1","teamId":"ac9c6a66-e4ee-404e-bf9d-0665a6515640","riderName":"Karabo Chikowore","teamName":"Dodo Blue Finance","gapSeconds":5},
      {"rank":3,"riderId":"93b6ec35-b5c6-4850-b4e7-544b244664e9","teamId":"f2e292c0-0c9e-41a2-8cd8-ed2a6bf83b57","riderName":"Tariq Sharma","teamName":"Abbaye du Lion","gapSeconds":9},
      {"rank":4,"riderId":"0a9158d8-1c95-414c-9429-bf6f1db20231","teamId":"c9db310c-1a90-4df5-9f78-fd48c8147425","riderName":"Óscar Pari","teamName":"Montecristi Toquilla House","gapSeconds":9},
      {"rank":5,"riderId":"4961f23d-f2d4-4a7f-a817-1ce59e29994e","teamId":"69b20e97-b88b-4c8c-b98b-b0fd28939913","riderName":"Jayden Douglas","teamName":"Okavango Stack","gapSeconds":9},
      {"rank":6,"riderId":"b59c2eb0-8f9e-4efe-8d43-01eeaf8b4a19","teamId":"c9db310c-1a90-4df5-9f78-fd48c8147425","riderName":"Rija Masire","teamName":"Montecristi Toquilla House","gapSeconds":9},
      {"rank":7,"riderId":"ae32212a-db75-4b5a-96ba-436365faba32","teamId":"f2e292c0-0c9e-41a2-8cd8-ed2a6bf83b57","riderName":"Claudiu Marković","teamName":"Abbaye du Lion","gapSeconds":9},
      {"rank":8,"riderId":"2f7e4d71-c30b-49c8-9f5b-dfaf3d334c05","teamId":"ca664ee5-06fd-4521-862e-ec20007709ab","riderName":"Mario Duarte","teamName":"Talleres Pampeanos","gapSeconds":9},
      {"rank":9,"riderId":"42c32356-3821-4422-9e48-49481210165f","teamId":"f2e292c0-0c9e-41a2-8cd8-ed2a6bf83b57","riderName":"Sajid Poudel","teamName":"Abbaye du Lion","gapSeconds":9},
      {"rank":10,"riderId":"afb01e9f-919a-4502-93fe-56b0027a42ff","teamId":"7ba5ff3b-d8cf-46ac-b82b-a53b34fed827","riderName":"Hatem Harbi","teamName":"Atlas Racing Lab","gapSeconds":9},
      {"rank":11,"riderId":"035f2053-7aa6-4e49-9de2-f520dc985a09","teamId":"27948dd4-0dac-416d-8f6c-118771bcb6eb","riderName":"Øystein Einarsson","teamName":"Kigali SafeRide","gapSeconds":9},
      {"rank":12,"riderId":"89ce1623-1004-4964-801b-0c4e8ef50ad8","teamId":"088a7b6b-a8cf-4545-b08b-4bff6c42b476","riderName":"Bo Wei","teamName":"Teranga Océan","gapSeconds":29},
      {"rank":13,"riderId":"ee7556aa-db92-4a21-9e20-5ae16e6431e5","teamId":"ca664ee5-06fd-4521-862e-ec20007709ab","riderName":"Faty Moreno","teamName":"Talleres Pampeanos","gapSeconds":29},
      {"rank":14,"riderId":"8c74c5a9-55b6-4966-845b-0a0d738790f8","teamId":"34026dd0-77b0-46d8-94ba-fd3256c8df79","riderName":"Valeriu Kraule","teamName":"Junkanoo Brass & Feather","gapSeconds":29},
      {"rank":15,"riderId":"91d3216c-00b5-40b9-bac6-f1214c471ec2","teamId":"27948dd4-0dac-416d-8f6c-118771bcb6eb","riderName":"Axel Aponte","teamName":"Kigali SafeRide","gapSeconds":29},
      {"rank":16,"riderId":"71fb4315-111d-4d4c-b0c5-b2c07668963d","teamId":"ca664ee5-06fd-4521-862e-ec20007709ab","riderName":"Simão Fidélis","teamName":"Talleres Pampeanos","gapSeconds":29},
      {"rank":17,"riderId":"70483f8f-1138-493f-b6d6-768899d5bc61","teamId":"de60b8f0-c3c7-4f8e-bd85-305439b1a482","riderName":"Rubén François","teamName":"Covoare Basarabene","gapSeconds":29},
      {"rank":18,"riderId":"ac2b965c-4e70-4543-9291-a4069abcc5f4","teamId":"de60b8f0-c3c7-4f8e-bd85-305439b1a482","riderName":"Broņislavs Fedorov","teamName":"Covoare Basarabene","gapSeconds":29},
      {"rank":19,"riderId":"57bc1231-b199-4483-b04f-4c7c2703310c","teamId":"c9db310c-1a90-4df5-9f78-fd48c8147425","riderName":"Rafid G'afforova","teamName":"Montecristi Toquilla House","gapSeconds":29},
      {"rank":20,"riderId":"f669e5b3-0830-4a54-af98-be1d9950cde7","teamId":"c9db310c-1a90-4df5-9f78-fd48c8147425","riderName":"Yash Patel","teamName":"Montecristi Toquilla House","gapSeconds":29},
    ],
    teams: [
      {"teamId":"f2e292c0-0c9e-41a2-8cd8-ed2a6bf83b57","teamName":"Abbaye du Lion"},
      {"teamId":"7ba5ff3b-d8cf-46ac-b82b-a53b34fed827","teamName":"Atlas Racing Lab"},
      {"teamId":"717c6861-163f-4cb1-b556-cbed104a000e","teamName":"Caramels de Keravel"},
      {"teamId":"de60b8f0-c3c7-4f8e-bd85-305439b1a482","teamName":"Covoare Basarabene"},
      {"teamId":"ac9c6a66-e4ee-404e-bf9d-0665a6515640","teamName":"Dodo Blue Finance"},
      {"teamId":"803e9755-570b-48ba-9b2d-6bbf5d8312d4","teamName":"Hexa Bâtiment"},
      {"teamId":"34026dd0-77b0-46d8-94ba-fd3256c8df79","teamName":"Junkanoo Brass & Feather"},
      {"teamId":"27948dd4-0dac-416d-8f6c-118771bcb6eb","teamName":"Kigali SafeRide"},
      {"teamId":"f2ffb52a-8a36-401d-90a9-ca5270cc8252","teamName":"Kyrgyz Highlands"},
      {"teamId":"b5fd7b9a-a254-4e41-9428-3cd1b2bf90fc","teamName":"Lima Maki"},
      {"teamId":"c9db310c-1a90-4df5-9f78-fd48c8147425","teamName":"Montecristi Toquilla House"},
      {"teamId":"69b20e97-b88b-4c8c-b98b-b0fd28939913","teamName":"Okavango Stack"},
      {"teamId":"8de6e531-3cd5-4d5e-beba-34fd54dc5ea1","teamName":"Penn Kreiz Crêpes"},
      {"teamId":"bb7c87bd-a474-4260-8f85-f349849683f3","teamName":"Sainte-Croix Automata"},
      {"teamId":"fe4ffe90-b0ca-4db8-acd9-b92078e7abc7","teamName":"St Etienne Cycling Team"},
      {"teamId":"ca664ee5-06fd-4521-862e-ec20007709ab","teamName":"Talleres Pampeanos"},
      {"teamId":"088a7b6b-a8cf-4545-b08b-4bff6c42b476","teamName":"Teranga Océan"},
      {"teamId":"c7d4f299-3430-4aaf-a029-ac9b97a07ed2","teamName":"TheWolverineCyclingTeam"},
      {"teamId":"e46bf500-2656-4c5c-85df-57daa6814b96","teamName":"UrbanRide Mobility"},
      {"teamId":"a81d26fc-5b1f-4267-8c60-073d53389733","teamName":"Yukikaze Outdoor"},
    ],
  },
  {
    groupNumber: 2,
    label: "Poule 2",
    winnerTime: "4h24′10″",
    rows: [
      {"rank":1,"riderId":"cbfba386-73e3-42a4-b9fc-2e59dc9fd31e","teamId":"12277621-b716-4b0c-934a-f1a0b52364ba","riderName":"Mathieu Laurent","teamName":"Cumbre Coca Rush","gapSeconds":0},
      {"rank":2,"riderId":"2856644f-3612-4e0a-ac73-44df175d4c11","teamId":"12277621-b716-4b0c-934a-f1a0b52364ba","riderName":"Gocha Vashadze","teamName":"Cumbre Coca Rush","gapSeconds":6},
      {"rank":3,"riderId":"33e6d821-2f7d-4666-92e8-1503266d0cf1","teamId":"b6932cdd-3ad3-4475-9509-080c35694f2d","riderName":"Fernando Javier Alfaro","teamName":"Pampa Maté Fuego","gapSeconds":9},
      {"rank":4,"riderId":"4140f9ee-687f-4162-9c67-bf6b0dae2042","teamId":"35061203-aa19-4986-83e1-b227cea4ecb5","riderName":"Ahmed Kiplagat","teamName":"Kaffa Origins","gapSeconds":9},
      {"rank":5,"riderId":"3699a6a9-9ec2-4be5-b349-3bcf37861ec1","teamId":"20bcbcf8-7f09-42b7-b4be-ce77d4aade10","riderName":"Zambry Zabul","teamName":"Glen Durnach","gapSeconds":14},
      {"rank":6,"riderId":"fcc568a5-2704-4cdd-902c-c6f8c2eb35d7","teamId":"96b66063-c5f7-4115-8be6-807c68a184bf","riderName":"Anil Mirza","teamName":"Ardennes Outillage","gapSeconds":14},
      {"rank":7,"riderId":"9854b7c6-3b6e-4763-af75-7c812b2e5ca1","teamId":"b6932cdd-3ad3-4475-9509-080c35694f2d","riderName":"Jules Morin","teamName":"Pampa Maté Fuego","gapSeconds":14},
      {"rank":8,"riderId":"c9a44ff6-4e4d-4cd2-a54e-249a1af501ea","teamId":"ac3691bf-5539-4243-b0f1-69385f340391","riderName":"Roshan Bhandari","teamName":"Indus Mithai","gapSeconds":14},
      {"rank":9,"riderId":"cdabfa30-fd80-498f-8edb-ddcffcb21d0f","teamId":"35061203-aa19-4986-83e1-b227cea4ecb5","riderName":"Alvar Johnsen","teamName":"Kaffa Origins","gapSeconds":14},
      {"rank":10,"riderId":"988dd779-1ef1-42e0-826d-9599f7c7659e","teamId":"b6932cdd-3ad3-4475-9509-080c35694f2d","riderName":"Ólafur Andersson","teamName":"Pampa Maté Fuego","gapSeconds":21},
      {"rank":11,"riderId":"b9895ac0-8f12-4243-8803-4e3cc2ae72a9","teamId":"52cf9278-cb70-4ed1-9c76-ae7263be8d70","riderName":"Chrysole Blanc","teamName":"Terroirs Unis","gapSeconds":21},
      {"rank":12,"riderId":"50c3fa44-c3ce-4b42-9bb1-6cbdfa6ffc06","teamId":"89df3cc9-9e81-4c36-8882-c19abb49ea0e","riderName":"Birgir Kristófersson","teamName":"Maloti Mohair","gapSeconds":28},
      {"rank":13,"riderId":"65886cdc-f745-4ff5-8ac8-47c1a48a91b7","teamId":"12277621-b716-4b0c-934a-f1a0b52364ba","riderName":"Ruslan Eristavi","teamName":"Cumbre Coca Rush","gapSeconds":40},
      {"rank":14,"riderId":"54d7855b-1585-44ac-87af-def0b5657bde","teamId":"76df78b3-d34c-4e8c-83d0-6e3976ad10b8","riderName":"Joseph Gadiaga","teamName":"Team Cochonou","gapSeconds":40},
      {"rank":15,"riderId":"e6647909-7bab-421e-bc18-696a4e851dc1","teamId":"cb8d8f3b-65c7-44c5-a3f6-8bf108a4bf2e","riderName":"Adriano Coelho","teamName":"Vereda Nova Automóveis","gapSeconds":40},
      {"rank":16,"riderId":"5db76e15-fb19-4504-9a1d-91513291f596","teamId":"fefee0ef-81a9-472b-9b8b-e9029815f396","riderName":"Dijilly Sidibé","teamName":"Stoke Kilnware","gapSeconds":40},
      {"rank":17,"riderId":"ddfb5676-9a99-4ff1-86c3-e290614f1020","teamId":"35061203-aa19-4986-83e1-b227cea4ecb5","riderName":"Esteban Cabán","teamName":"Kaffa Origins","gapSeconds":40},
      {"rank":18,"riderId":"0506b486-358b-4223-aa32-449d38b90aa3","teamId":"bb75529c-52ea-48a5-bd0e-879c97a1f924","riderName":"Ghebrezgiabhier Mulugeta","teamName":"Musanze Lava Stoneworks","gapSeconds":40},
      {"rank":19,"riderId":"e02c9942-c9ba-46f0-9b0e-71d7f2c5ca60","teamId":"6d29ce14-c55f-4e3e-bd73-59f410484210","riderName":"Bảo Long Tam","teamName":"Cidrerie de l’Aulne","gapSeconds":40},
      {"rank":20,"riderId":"db076d31-23b1-46c0-a7f5-143d03ea1234","teamId":"b6932cdd-3ad3-4475-9509-080c35694f2d","riderName":"Þorgrímur Alfreðsson","teamName":"Pampa Maté Fuego","gapSeconds":40},
    ],
    teams: [
      {"teamId":"96b66063-c5f7-4115-8be6-807c68a184bf","teamName":"Ardennes Outillage"},
      {"teamId":"1559096d-c142-49c8-b4bc-5cd5cc9830ed","teamName":"Bijagós Caju"},
      {"teamId":"6d29ce14-c55f-4e3e-bd73-59f410484210","teamName":"Cidrerie de l’Aulne"},
      {"teamId":"12277621-b716-4b0c-934a-f1a0b52364ba","teamName":"Cumbre Coca Rush"},
      {"teamId":"20bcbcf8-7f09-42b7-b4be-ce77d4aade10","teamName":"Glen Durnach"},
      {"teamId":"ac3691bf-5539-4243-b0f1-69385f340391","teamName":"Indus Mithai"},
      {"teamId":"35061203-aa19-4986-83e1-b227cea4ecb5","teamName":"Kaffa Origins"},
      {"teamId":"caea0559-e3a6-408b-9e2f-4a7755859dd6","teamName":"Kriti Gea"},
      {"teamId":"0ceb562b-737c-4650-8e70-5570a915dc41","teamName":"Lilangeni Ingilazi"},
      {"teamId":"89df3cc9-9e81-4c36-8882-c19abb49ea0e","teamName":"Maloti Mohair"},
      {"teamId":"bb75529c-52ea-48a5-bd0e-879c97a1f924","teamName":"Musanze Lava Stoneworks"},
      {"teamId":"b6932cdd-3ad3-4475-9509-080c35694f2d","teamName":"Pampa Maté Fuego"},
      {"teamId":"72c9694f-64d0-491e-a79c-68f655ae6a36","teamName":"Québec Nord Racing"},
      {"teamId":"21f9b80f-5edd-488a-8fc0-3f30da77be55","teamName":"Sardines du Raz"},
      {"teamId":"fefee0ef-81a9-472b-9b8b-e9029815f396","teamName":"Stoke Kilnware"},
      {"teamId":"76df78b3-d34c-4e8c-83d0-6e3976ad10b8","teamName":"Team Cochonou"},
      {"teamId":"52cf9278-cb70-4ed1-9c76-ae7263be8d70","teamName":"Terroirs Unis"},
      {"teamId":"ad506cc8-91ff-4306-a30f-b1397e2154a5","teamName":"Uji Midori"},
      {"teamId":"cb8d8f3b-65c7-44c5-a3f6-8bf108a4bf2e","teamName":"Vereda Nova Automóveis"},
    ],
  },
] as const satisfies readonly SeasonFinaleGalaResultsGroup[];
