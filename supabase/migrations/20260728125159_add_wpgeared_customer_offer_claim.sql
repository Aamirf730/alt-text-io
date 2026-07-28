-- Add a one-time, authenticated offer claim for legacy WPGeared customers.
-- Eligibility is stored as normalized SHA-256 email hashes so the customer
-- email list is not committed to the repository or exposed through the API.

alter table public.profiles
  add column if not exists bonus_credits_remaining integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_bonus_credits_remaining_nonnegative'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_bonus_credits_remaining_nonnegative
      check (bonus_credits_remaining >= 0);
  end if;
end
$$;

comment on column public.profiles.bonus_credits_remaining is
  'Persistent promotional credits available after the active plan allowance is exhausted.';

create table if not exists public.campaign_offer_eligibility (
  campaign text not null,
  email_hash text not null,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  credits_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (campaign, email_hash),
  constraint campaign_offer_email_hash_format
    check (email_hash ~ '^[0-9a-f]{64}$'),
  constraint campaign_offer_credits_awarded_nonnegative
    check (credits_awarded >= 0)
);

create unique index if not exists campaign_offer_one_claim_per_user
  on public.campaign_offer_eligibility (campaign, claimed_by)
  where claimed_by is not null;

alter table public.campaign_offer_eligibility enable row level security;

revoke all on table public.campaign_offer_eligibility
  from public, anon, authenticated;
grant select, insert, update on table public.campaign_offer_eligibility
  to service_role;

comment on table public.campaign_offer_eligibility is
  'Hashed recipient eligibility and one-time claim ledger for promotional campaigns.';

insert into public.campaign_offer_eligibility (campaign, email_hash)
values
  ('wpgeared_customers_2026_07', '75811104aed675af3483b0fd57cef9867960fa8424a371cfddaa7553da21cbef'),
  ('wpgeared_customers_2026_07', 'f4d371f67bb4ccfc7a02dec296cfbde1e654d8d4d4d1c4829ea2e41282c64853'),
  ('wpgeared_customers_2026_07', '971633cc4300ff1de2eb0f273b62220f1866b4353fafc78b49f30f46cf5eca31'),
  ('wpgeared_customers_2026_07', 'a54d0f7613010c1813d06cc5f540b9b37088d04ecf589f6a2d1980f7ce115912'),
  ('wpgeared_customers_2026_07', 'c56edfbfff73ae22689d962cf0fced589ee0a4d2b5e7e06c38398097bf5dab17'),
  ('wpgeared_customers_2026_07', '9eab14773e322a2608abf936f2d2a6b229495cddaf030b080aec6a82df99a2c4'),
  ('wpgeared_customers_2026_07', '671819c6d5481a93f6802d8936ecf6022afc4692d044046151c676c0c1356bd9'),
  ('wpgeared_customers_2026_07', '8c03519cc06728abbac419ddcf53b59643eabbc9a764567ab09805d1c0082907'),
  ('wpgeared_customers_2026_07', 'b6a6daa62abee2e2581c35786d69d81753bb7a1f274d0a723655a31d81035da6'),
  ('wpgeared_customers_2026_07', 'fe9a690970a93fbf7a058d4b2c5a44b42c999d5786d3867541d17d637e7c1714'),
  ('wpgeared_customers_2026_07', 'cd6b7245662ca41cc4e37c8d3cfe22c723241b9519585d65d1e3836401286a19'),
  ('wpgeared_customers_2026_07', 'e0a877802bcf3db43260455de73067fb80b3914192cbc8c63170a12d5484e8aa'),
  ('wpgeared_customers_2026_07', '4007a30bd050406f030e67e3be0f2e82d55341ab4de72980db09990a1bdce7f9'),
  ('wpgeared_customers_2026_07', '5492112b46cc21cf3275720512f5e34381beb441971dcffd04f71862d861830c'),
  ('wpgeared_customers_2026_07', '4cc5c90cafad38237c5451c4aac616137b82fcd516e737b888f582e2d7193730'),
  ('wpgeared_customers_2026_07', '16e78820ffa426af33e2d528f60eec45df34529ee247041387bc4bdedf563dfb'),
  ('wpgeared_customers_2026_07', '9841c3ff49c3ba7688f5cec6b60fca50e060f5173604c541808ee4e4a2e1eb51'),
  ('wpgeared_customers_2026_07', 'aacf72ab511c9e298c08431ebbc3cbc6a1ba4122cc08e60cb4e92bfe3560353e'),
  ('wpgeared_customers_2026_07', '9e3498ea5995f8f0f41bfa9cc10a469b0597d1edfe2b8f34bd4e4a3ff6d1fd32'),
  ('wpgeared_customers_2026_07', 'ce5a5c17d8a411db769e51402b968c4c81d737f2697bf59a3046866d6877c2a0'),
  ('wpgeared_customers_2026_07', 'b18f9396adc2f99143961ba6865667d705fe1c7c00a92e0a6125f844493e585e'),
  ('wpgeared_customers_2026_07', '827f17e14ad375e6b15e07d0931c23585b293f03d8d0108e28de93ffb2c9dae1'),
  ('wpgeared_customers_2026_07', 'f88c8007ab9a206e09c5e1603ef0afcff73efbc42389d855281f210578245e7d'),
  ('wpgeared_customers_2026_07', '948def1411b5921be6a4eaf1f62412fb6b800b993fb62fef0c0514a63f990c40'),
  ('wpgeared_customers_2026_07', 'e3f4153b093afc95839de3df7259232526532dd329d1deb041b3f4b12a7b1667'),
  ('wpgeared_customers_2026_07', '55e98e5905ee87c06644fc9e3e1c98621687cb16a232b1a2621eebbfe4962d4e'),
  ('wpgeared_customers_2026_07', 'eacc1224bf3c4d797a755f01a57b2360d8c38d174773a440abd25394f68a3904'),
  ('wpgeared_customers_2026_07', '664482f4b37a16c069b2b06504c380762b5b6d429841cc475bb3468963daf9bb'),
  ('wpgeared_customers_2026_07', 'fd7aae7d5ffaa920ea4428ff7a60e19a3ef8174cf0bbc330283986c4721f98fb'),
  ('wpgeared_customers_2026_07', '8e1a190d2516bbe8ac0eccaffeaa4d4b95989a36672607ef9ad2ca191e86e290'),
  ('wpgeared_customers_2026_07', '11b00b64551a070b492803a9c5cc70489be1956e7d8c2addb5ea45f21b5d20ce'),
  ('wpgeared_customers_2026_07', '685fb31cf404b379afa2232afb411cd5a743fdba475f91e2162afb4f9aa1cacf'),
  ('wpgeared_customers_2026_07', 'd5dad334ff21c91be09e5f1936693eb8057381154805f6fc856a9fc1b984c461'),
  ('wpgeared_customers_2026_07', 'ee0b8ac1c22be523db29e74121e23739064482d67b6147ac86991fd9ae747fc7'),
  ('wpgeared_customers_2026_07', 'ac36cbc8994878ee292faf197fecb0dcb20995f0ff163059fdb748ac87398be0'),
  ('wpgeared_customers_2026_07', '3133cb1e9d41c29fd45dd7ab639de8416be4411e75b7e6fa80d5380aa58f623d'),
  ('wpgeared_customers_2026_07', '1a9b5457f2cb34157fb8f4d4b506026f04927b0509e146e870b717c5df75a7a5'),
  ('wpgeared_customers_2026_07', '6269bb5a9f9f91f25f9c73a691bf7ec846a466bc8f3f48e85e70bf4fe286d710'),
  ('wpgeared_customers_2026_07', 'f2687524e3842bede7f1182a3b7bb7e71f7c4c0b057cd711c9171d0af60ab90b'),
  ('wpgeared_customers_2026_07', 'f16c4d1e0df9071ca79b790f8a90a50f4e0d2765361fdff3746b5b5ea8991b1d'),
  ('wpgeared_customers_2026_07', '6eda92d0cc9da9592ec307e2997228a07e7c77051ba99e355db8d807c4dde4d1'),
  ('wpgeared_customers_2026_07', 'adc7cf35e67d8df6a476596cee326f79bc53f62b892ac42108c31500fc4e39f5'),
  ('wpgeared_customers_2026_07', 'b7c10034d6359f4f11b190b60e8f767a1482e0726c56faf058d13fcd26d731c3'),
  ('wpgeared_customers_2026_07', 'c66fe6331163665c92a3ebe9207db426a7e0b32a0121fee46f58cf8ba34226f3'),
  ('wpgeared_customers_2026_07', '3c5c4ac84ee5a15ba8c4927b8d7674c7f1838dc7cf8352805e46cf59db0c4144'),
  ('wpgeared_customers_2026_07', '06d8c172494f5b29893a5e7060787537c5e6cb4d2e02c657a740f8414592e077'),
  ('wpgeared_customers_2026_07', 'c16ec934b53ba51d6c416242365c8fc63406b515b3e52c085279f1b22583df5d'),
  ('wpgeared_customers_2026_07', 'b2a750198e3a79987a90d1f68ed0b06740020c5e7f224b50af48b6cb0656853d'),
  ('wpgeared_customers_2026_07', '6f2d43801dcc82fb6ecb350b0b63e0e22db310defc8c8240fb4a8c5ad43139de'),
  ('wpgeared_customers_2026_07', '969f61789bd5d3eb98d9221714a051442db2120b54febdcbfa69b8085a4a8af0'),
  ('wpgeared_customers_2026_07', '4e11a804b13c93635ea4f789244618029959fb8a5b8864f91fd87c16dd2ed198'),
  ('wpgeared_customers_2026_07', 'd1878acfbc568422e1932770bd8cf2e511460e803f291dfbd743130c826568cb'),
  ('wpgeared_customers_2026_07', '06d71ddeb373f49ddfb321c5c1eb66d397f9d22b96be68faa6d9ac69b95d9dae'),
  ('wpgeared_customers_2026_07', 'ca2d582ba69e9435b094ad585c9eb42a9eda215f5fe0607e44138441e1c5735e'),
  ('wpgeared_customers_2026_07', '19a2b0b557baa9fe33ec2a31e4937a4fa86d9f515ea6872fc17686ac02b2384b'),
  ('wpgeared_customers_2026_07', '77003be4316aa097463bb58e46ae6add5d0617aaa6f96e0bf1ed926570c1807d'),
  ('wpgeared_customers_2026_07', 'deb50671804f0d3b71ab4424c0ab1c3e87028831d7df7ccd2164ac67e564467a'),
  ('wpgeared_customers_2026_07', '62cac578c6a3ef6adb71c141401aa7266f2d3ed8ad755666b3ddfcba7870cb7d'),
  ('wpgeared_customers_2026_07', 'd621f335a7b65bcf48fba4369d4deb76bdc6118ab81c22d07be6229dd166d6ff'),
  ('wpgeared_customers_2026_07', '23bb83bbe0209bb5a508e1956331841df27073341004018dc528ac7eba1b2194'),
  ('wpgeared_customers_2026_07', '054daaee56752b471d34d4d4711c940f27d8d70949e25ddf0b51eca60316e5d8'),
  ('wpgeared_customers_2026_07', '8106c11313b3987c87d1288cc90a204bdfed8784e3f142255c21ea0a9bf7b24b'),
  ('wpgeared_customers_2026_07', 'f8c39107c1a81087b9b9078fb44b96ce9a73d781674c6e882d24a0597280f8d7'),
  ('wpgeared_customers_2026_07', '56e4af29ddb10613ac6f7a396e854411dcbcec15d9c4130495dc05aa72750ddc'),
  ('wpgeared_customers_2026_07', '62e754b6d4fb6c70608222f7e103e99729a5299fc5a4337061a4cc3fafc3c3eb'),
  ('wpgeared_customers_2026_07', '2b1048b81231b8d52fb3de13603a320b725df7bce02fa2d3b234b3aa85db23f5'),
  ('wpgeared_customers_2026_07', '5452067afbc46414f538aeb8b9707fbddb71a0d95fdff42ec294d899763a8cc6'),
  ('wpgeared_customers_2026_07', '9a22ab3d4954145cad6411d7ebfbddefc659f26bc547d77f7c4cb99ef9f691f7'),
  ('wpgeared_customers_2026_07', '035096a76f1ad9297de6c570d12c698eaff205ec0bc6eaa3a87beec1fb9b9a67'),
  ('wpgeared_customers_2026_07', 'a24fb0850d19977b2a273f3853164c72a224c4761ecfe5ec4b800ef05636f12d'),
  ('wpgeared_customers_2026_07', '8c0c726f4dcc1660f6d4146937ec647442b23396046ff51bdf8665f48f2a1b6a'),
  ('wpgeared_customers_2026_07', '517f3509850c0c5ae5c80ed6ef2859f5f4547a65d723e60b531d66207911f365'),
  ('wpgeared_customers_2026_07', '2d0a6ca64f86e29cc0ae4bdce6343301c66addd58bcfd3a385a01905d1dcf7d5'),
  ('wpgeared_customers_2026_07', '5a103abffbc39764f5029eb758d7bda1ae1d97a460dace078d9d808f7c06f91a'),
  ('wpgeared_customers_2026_07', '77656b4866a73c2b4e86181c0216a126dcadc7ad462e1ecf2857292c8452fdb1'),
  ('wpgeared_customers_2026_07', '6817a6c8214a23d1f17f7a4b3a3788dfe90b8282c5d4c23a130a3402e47473f7'),
  ('wpgeared_customers_2026_07', '86b3d5550ee2380cacaeffbb8d21855be465df58da73f35e470b296f827e1ff1'),
  ('wpgeared_customers_2026_07', '630d096b1d7face9939c7db9efc9ac36080b7067063ccfd71dba2bb2ff332644'),
  ('wpgeared_customers_2026_07', '8026fd373dbb4958eecf1b5328526a7ff1a060f6bc11cbe2ea21a94d538fe5ff'),
  ('wpgeared_customers_2026_07', 'dbaa469dd8978138bb6d134b3426941c684db9b1024c0a40271d67e19faae5e1'),
  ('wpgeared_customers_2026_07', 'a787ca92c91fba8869043208530416e01508dbac89f13e8039f2fe3dec904e2e'),
  ('wpgeared_customers_2026_07', 'da2a6202a88aebca8b71648426a37ce2b811993f608a75187bd8aaa0d853ab4e'),
  ('wpgeared_customers_2026_07', 'b4c8bf3a104e809e5fe97d275900209ddd4a819512b53eb394bb8a53da9d213a'),
  ('wpgeared_customers_2026_07', 'b0fa371f7cbfccf093edff5d676143b70f658d4880f4174003f922e264e1a32d'),
  ('wpgeared_customers_2026_07', 'f1098fd1a3bde0ab047b608bb4b75a91040208c377b3b7fe1bf317829621d28a'),
  ('wpgeared_customers_2026_07', '0cfb34ce86e6c723de1331a1c07172e035dd5f142525214d9efabbc495768309'),
  ('wpgeared_customers_2026_07', 'ec521695602ddc69a6b952d36707dc1f83d104e6f90624e57d21d85f897093c8'),
  ('wpgeared_customers_2026_07', '24449077198a9f6ace54f849080a76c71a5ade206d502d829bbd2b7f9cf819be'),
  ('wpgeared_customers_2026_07', 'e294f60c8a438bb014f2390612e9d6cf7cd6880763ba479db27fb5cf4ad459cb'),
  ('wpgeared_customers_2026_07', 'b3311844b8b3be040e66c501e3730dc1a3be8babcefa87868e8c0d8178fe30f1'),
  ('wpgeared_customers_2026_07', 'e33e31482cd4482f491e1cfd25895b0d3cdc2dfec8a3416190857a44e9ea3faa'),
  ('wpgeared_customers_2026_07', '3755662b5c1ad468bbf722956370c3baf99699e9b18811248d718165307bd4e4'),
  ('wpgeared_customers_2026_07', 'bdc661e864c15535cacae4bdbf03bca25cc5df2d735c543a436825d6bd8993ef'),
  ('wpgeared_customers_2026_07', '51d0cd43c165b4adb0d9e2fb3fa32a9566cfabaa64972ba1b1cee11a821536a2'),
  ('wpgeared_customers_2026_07', '506313264fe23ffb72cc8101a5358daf1c2fb319b7b77c494e7332523c51095d'),
  ('wpgeared_customers_2026_07', '6296222ee519e3ffcbd87d4a3f628aaa61d0668a32a2493d78aa36e0718c9390'),
  ('wpgeared_customers_2026_07', 'dc3f509741c8e6146f53998090b1b7bd38dd31c9103a68514b480926ecdd147e'),
  ('wpgeared_customers_2026_07', '5acfeac046ccfc0749e848cae2938a27a17e9612251397761eaa147e63929330'),
  ('wpgeared_customers_2026_07', '68d9756a320e95b5fb515c635128a1f3abe9014f92a0b351c3ac6b91357664c2'),
  ('wpgeared_customers_2026_07', '5e006603436e1df627c343f8d72aea83a0dfe22e53ddeb7665c305b934cc80ca'),
  ('wpgeared_customers_2026_07', 'a2c1b7e0a2fbdf8d6c2d466d327dbfbe929b00135b4e624a559b5d2f0c88c585'),
  ('wpgeared_customers_2026_07', 'f06cfa41fade430214f5ec696b4750568a66657b4581bf538b7dbc9354b246af'),
  ('wpgeared_customers_2026_07', 'c0ade85d33fe08b52120459d1009f7b7c515230ae78f311ad862794b527214e7'),
  ('wpgeared_customers_2026_07', '375aca96b7e6789c4a889160cfef762c30038b6e3ed86b51fa2d376f6b498cbd'),
  ('wpgeared_customers_2026_07', 'cb96187ef200847ffc73a450551bbc89f06fe47c277056d900e6806d5c802c10'),
  ('wpgeared_customers_2026_07', '77591218665b77702b2200f171c9d7d30d2c2a241c84caa3d0ec15831583fc48'),
  ('wpgeared_customers_2026_07', 'f6b1b62d766c8191449a2f0de3eb1c52606df27376e2bed13e49bc990be7d733'),
  ('wpgeared_customers_2026_07', 'fdf88a61f6e508273d09289bce30661a5ec5d4280559b1e9c8d8a0c4d8695a81'),
  ('wpgeared_customers_2026_07', 'daa1c731c04c0c7746508a42fe1b139f8d6ca602e405a9687b4ac684002870a3'),
  ('wpgeared_customers_2026_07', 'dad0f40cfc222f80e71eb4f0b4aa93de088cc504424d1b60124e86497aac4552'),
  ('wpgeared_customers_2026_07', '7e520c1443505032fd18c4b2fde4733509d9151d0ed818f441211465ea6a42a0'),
  ('wpgeared_customers_2026_07', '4ac56af2872a584d1850d098f5c4a4492a229d5143c6343a61092c7625517f26'),
  ('wpgeared_customers_2026_07', '746836ea799b9644bde6ae1a4a20892bb71d7273b41437f62c38a93288b472ca'),
  ('wpgeared_customers_2026_07', 'db865f059ba9b36c4cf4d72efa11f515cdbfdbc3911b3ba20fbe2b13b3f88408'),
  ('wpgeared_customers_2026_07', '9b64f4c79dcc93b11c669496e0f53c9bfa7538400922d9c6a2a0293346457363'),
  ('wpgeared_customers_2026_07', 'ecd68dd572bfe888d91d486ca2af1e9bfb0f80f41c7e51443174e588909c83ca'),
  ('wpgeared_customers_2026_07', '23f0db44f7b937c1e35260391ab7ad6fb191a3a17c555111690eb6f8f578d34c'),
  ('wpgeared_customers_2026_07', 'eb9bdcce87743313a2559e752d84f1554b56f57ea002831d48a5ba37c24e8edf'),
  ('wpgeared_customers_2026_07', '1a59a19e09b6db092146164f66634120d780dc29976ed0ad42df65bb6a30c3d2'),
  ('wpgeared_customers_2026_07', '02088fb1c63107c3cda3b0e0d9b9943527ba142d21e495a493a1bfa2925ca831'),
  ('wpgeared_customers_2026_07', 'cc0d7c1b6aeb023ba15329cb54e937b5e509ba0319ad50efabd187f523ae64eb'),
  ('wpgeared_customers_2026_07', 'ed3b4096d92eab6d6c7992b007178ada0af1c12c82c9047a03eb8caf275bf404'),
  ('wpgeared_customers_2026_07', 'a17f211d6323dac6cbbc57e3f2d86b03511d1135236f9f1df9d9014fbd75c865'),
  ('wpgeared_customers_2026_07', '61df45910dce5f256a3834a6a0849c8a141689fc7a5ea609dae291dd6f12cbba'),
  ('wpgeared_customers_2026_07', '4d1b568f1d80e7d4fc2c7a477b148bb9d9d6846dcb6eb576ea27eb81c1167724'),
  ('wpgeared_customers_2026_07', '2c9e1553717fb657775efcade736c184326335ead8103f9e3ca921701bd42cc1'),
  ('wpgeared_customers_2026_07', '89e55b7230e8ee6d2580e776846579706c8ecd2aeefeaa35047bf248f12cc69e'),
  ('wpgeared_customers_2026_07', 'f35d92cd220512cefb769ad66fe5bc07f582576eeff6ebc64d2e945e295cd40c'),
  ('wpgeared_customers_2026_07', '6fd0256c5a19f9392e60bb99f15d3c7bd50ddcc0df5b0c214ff99ae703a74293'),
  ('wpgeared_customers_2026_07', '1836af179f2469506489b96ea6de20cdb1bcd40e5a9692f68a54c5c550ca1caa'),
  ('wpgeared_customers_2026_07', '482f2a29abd2c1700faf4b7ede9a29c99c09dc5a76a8c9c2443fd2e05953efd1'),
  ('wpgeared_customers_2026_07', '7235339c5b2548f8c268e98858c14277015b564ed48e29728f48fd4054f8e9aa'),
  ('wpgeared_customers_2026_07', '0aec5df2e0228cc0573f8c7b3e887128c11a97f9f7220f4c4dfd72235256586e'),
  ('wpgeared_customers_2026_07', 'bdbe7b34ee07d70ae3350953f63e7a8d182ea3585c8b07fcbb6f7a896e081c21'),
  ('wpgeared_customers_2026_07', '24755e4d53973f83d8bd9fa8497ce4695900e35862d72845a2627966d7d3e02a'),
  ('wpgeared_customers_2026_07', 'cbe1d3c646ff8c12a81780e972463c3a66a84dd6a97853e0bdb882138a32ab8b'),
  ('wpgeared_customers_2026_07', '342b7956a07a4c258a660dc05ba73936b6ffb9e6fc9127f9613ba4a9891670d4'),
  ('wpgeared_customers_2026_07', '68441384f34b4ea2d4acbd9bb6cb4e857b8789ef1d3e3cf2863db0e10d748646'),
  ('wpgeared_customers_2026_07', '48225cc040b4469d7e8cf2cf4e1b7558855738ed2961060a27ade1741897cee9'),
  ('wpgeared_customers_2026_07', '960bdc98c337b6a78710157c67a312769834ffbb4f8b9761078b4305c1ac3b74'),
  ('wpgeared_customers_2026_07', 'd1db287a6e2f77f7b7af62e7ba8421835f83d79c01eeec73498b4f2f037161aa'),
  ('wpgeared_customers_2026_07', 'ab1f40079cd72e7e2a03819cda37786db002ef3b7c46c82b0929c5ef0f9f2ef6'),
  ('wpgeared_customers_2026_07', '82fb14d984046a074ba0871b47776b7b69f5128ccc56a0eba72a979f3bd55265'),
  ('wpgeared_customers_2026_07', 'd03004ff90ed69ce56a3bb42b2857cabe881e350c53bfb93b82b529da397653f'),
  ('wpgeared_customers_2026_07', '584cbb23c01ce7d6b4ee95cb33158a7ee761a706d30aa9df9b8a98caf365fd38'),
  ('wpgeared_customers_2026_07', '76c69a890111c0c8b98c4eb49c5d48e8a8eebd98abfa11e8777ed7d4d412327e'),
  ('wpgeared_customers_2026_07', '6492649ce67081d08db451d0169104f1ac2a8e5fdbf8f2c2996cabaa70befab1'),
  ('wpgeared_customers_2026_07', 'd5901e29dc3b7a26ef9f9d22b88f70299a193eefe279e65aa4c5b99b3a71ca74'),
  ('wpgeared_customers_2026_07', 'a3a3661f51b02b0029c9f722730765315eb7a35d93906eea98008ab4db71f33c'),
  ('wpgeared_customers_2026_07', '67925c3569853b2a0826030dfb3a1fb07a29535ab42f9b11de4d086faf4ee8ab'),
  ('wpgeared_customers_2026_07', 'a1b7d0d3262948144fa11045ac86d5582785921390a32905282c1d1501afd789'),
  ('wpgeared_customers_2026_07', 'f2019a0877958ad0ddd21ab43c2355ae88f29caa3fa1d8ade846f3ae694971fd'),
  ('wpgeared_customers_2026_07', '81fd99fbf65ee35fa0901304940e0acd854342645244b3aaf02b23cf69056035'),
  ('wpgeared_customers_2026_07', '8077751f5616421bc87609b0b58ce3d0f2bd17db22cd6630dae7bf483356cb03'),
  ('wpgeared_customers_2026_07', 'a8820321257778ee4e70ca70cef4d89be33a96895501fc762f92d5def11ef5d9'),
  ('wpgeared_customers_2026_07', '9e3c9316c75c775affb69c6ff2de8adb9d378934f055f0550264076aa5648d41'),
  ('wpgeared_customers_2026_07', '7aaba81ed2a8a7a026e0369fad04f19ad37ef69a429dee4f0a4497a9a541695e'),
  ('wpgeared_customers_2026_07', 'ad6d1d3aaecb27857ceb075466ec1e2d82a09c647cdf97f79c764b359f9bc209'),
  ('wpgeared_customers_2026_07', 'a2e83c92b1ed62f93e8fe89b6fcc750936b50558009eb17fc1dc174ef31ffd90'),
  ('wpgeared_customers_2026_07', '7413971f6e516b2bf28dedbcdda9942fcb29ae95107cde02a49fd0bbb6e44ee3'),
  ('wpgeared_customers_2026_07', 'daff4e1f3583d538d863c7bd9f3cbf2294f0c07ce9d910b19e00df7dfad45ab1'),
  ('wpgeared_customers_2026_07', '68e3e01a158d84b0229f041922a8f3cb98984ee8847928ef9685a9630d46cd0f'),
  ('wpgeared_customers_2026_07', 'edf75c2a30a8e169a52e3a072b85abb64bde981b9b8d62c7845a306ba6d6fcf4'),
  ('wpgeared_customers_2026_07', '5a745995b3e6f312df77a3d8d1a0e9cba459d5ec5db170ef80e322ac2c174f55'),
  ('wpgeared_customers_2026_07', 'd96471884de837608f408d6b20b0731b71f186b52d3c98f12eaea7526c163629'),
  ('wpgeared_customers_2026_07', 'a07da2dc9b352faf82831c1499dee7fd33034bd9007f32048116317ee217f2be'),
  ('wpgeared_customers_2026_07', '33ecf889dccf4c91f86e3fe641d1cf365aae8580085f8b7957bc8f8a3d768d9c'),
  ('wpgeared_customers_2026_07', '8cbeec4733983e48540d9e30ad4c1b122a8fe24608a79f94f01adb8f86e3157f'),
  ('wpgeared_customers_2026_07', 'a1303acfbeba7cb44b5f18559a6076d8ff8582212b674b2e8388f9d1743270a3'),
  ('wpgeared_customers_2026_07', '05d21f8d74566bcbdf04915d5dce5c98b1299868021ec0eb4d60ac46df7b9b9c'),
  ('wpgeared_customers_2026_07', '6ca92b76a6d6ccea3895d614674ef298faf0cf9f1b62c489357ebf9691a327ab'),
  ('wpgeared_customers_2026_07', '68d45d148aee0141efd3aa4dc2be843d1b945cfe415de37d6f28f90d16254583'),
  ('wpgeared_customers_2026_07', '5bac2d137b9a80e46c761ecd06a4bbecfdc7b7abf5a6ddd0d599e7e5e6bd1816'),
  ('wpgeared_customers_2026_07', '59e2ce983c04f68584139b2e7b34c23cd5eb72d187e8d8acfa82e5e7a1fe7fb3'),
  ('wpgeared_customers_2026_07', '62f7eb43e211c91fbd21ef0d205eaf6e48cb3e749df8e82782bd6758cc45beb7'),
  ('wpgeared_customers_2026_07', 'eea8df79fd1aba59978b1bdcb19d4e62d11109a3b2606610f4daa2ea3658b29c'),
  ('wpgeared_customers_2026_07', 'e76fb680fe9cc7fc3e0b0ee904dacb99fd99145a45080b56e72b8624a174ae96'),
  ('wpgeared_customers_2026_07', 'bbcae073a1cd41af0c1333fb9e2c656a4d23c558bd4a70f9d37639578e5e0b24'),
  ('wpgeared_customers_2026_07', 'a2e48b270a785df2f01f801f87f228044290787ef0b06ac252e79cb0bcdf0e8d'),
  ('wpgeared_customers_2026_07', '89a1e44a496df18f856158ecce9674aabc2c0a12f69e7b264a0c7615bc2ca777'),
  ('wpgeared_customers_2026_07', 'aab695440760752f0ab358835b23760f6db6d068a6d710fbf1d81fe4364c6328'),
  ('wpgeared_customers_2026_07', '4fdbe85b82db18af38d43cb7f356abd17f1ef8211b5ab972266efe81d0cb3810'),
  ('wpgeared_customers_2026_07', '41a010a7bf4097b1c0667dc877a6397e34cd063f72c4cc228041c0f61162dfbe'),
  ('wpgeared_customers_2026_07', 'a4dd366e307cdd4af6d4150876a0bb03cc7e69a357a03787cec1582549c56abc'),
  ('wpgeared_customers_2026_07', '34ad173b3ea9d8c71b15664c197d80f590ead741cb260556c261a0362e5bb49c'),
  ('wpgeared_customers_2026_07', 'b5da0788a37a09786a19425d6c644293d4f17a93ec6a387ed1eff6c5562717d2'),
  ('wpgeared_customers_2026_07', 'f05da082f8f3d30c8b1fa01eae9f160398ce8db6d118479a8906580e4d025a45'),
  ('wpgeared_customers_2026_07', 'e666bc6876203ba4698e9e4b0360bfec395aa4421d956fec421a7415acaaefb8'),
  ('wpgeared_customers_2026_07', '4926387080881962da8ac7fa297eabdfc4b09a9bad2979f70e5844e0ca4f63f0'),
  ('wpgeared_customers_2026_07', 'f457fa5c15c0898d784eb7b16ff754ccb329c3a7d5d859211b8848b366857a8c'),
  ('wpgeared_customers_2026_07', 'f3869fa06790ad6dfcb61a462bb5f7bc72b95533264be80136d2b3e3ae797dc3'),
  ('wpgeared_customers_2026_07', 'f250cc0d163a117b93d9e90f9fab87246dde61dc2bad392462cd8149912175c3'),
  ('wpgeared_customers_2026_07', '2709f77f7c787ee698d8763e4da22231a7353492de9104afd9c00a6c8926f0d2'),
  ('wpgeared_customers_2026_07', '592f8c58537d1574f18abc87ffc38ffa4e9ec2d46dd506f2670308a32829608b'),
  ('wpgeared_customers_2026_07', '468ba335a98aac8743da35d17d8f84c1f06af1d3ff8b1cef06666a1ad18c6879'),
  ('wpgeared_customers_2026_07', '7a297cb58d5ebf3e46fedadc2bf516121156ad50a7027d1b243b5114b0b4e930'),
  ('wpgeared_customers_2026_07', '1b8eae114f4f8c52f7f5647c95b33e98169c80286934d7ba26923457059b1067'),
  ('wpgeared_customers_2026_07', 'd92b1444af7fd8f177dc0bd7944b3d448d88fc6fe5aee50e55eff67248b346c8'),
  ('wpgeared_customers_2026_07', 'b819a11eb99e22084d32b5fba2d605f59634574d5ad56352cda313aea8558a80'),
  ('wpgeared_customers_2026_07', 'a184ffa6dcbb2967eac54ba72f5d5aefd62d0ae7144b0a2c0b2b5b810239910f'),
  ('wpgeared_customers_2026_07', '0622b58a8a1ebd07fae81253588f3af53a28645318b074e8662e2f59ee50021e'),
  ('wpgeared_customers_2026_07', 'fc8734e3edf0e457134dd3f40d3bc5419fb2d05b83988e5eb7e241c1e29760c3'),
  ('wpgeared_customers_2026_07', '5c3b0056159d134ca3882b936d1fcd0182d24ee99e21e71da9bb335a1355e576'),
  ('wpgeared_customers_2026_07', 'c7b215576fc8167e197b826a6410967a5d0eec86747f0212939353d4b9637c61'),
  ('wpgeared_customers_2026_07', '747fafa64ad5d3afc9d872c9b8403eb1c0dfebc85e57651ca8f0a8b429ba69cc'),
  ('wpgeared_customers_2026_07', '1026b7262c751e85b039a1c2974ae2b00ce47006503e3e6cdc65d254af00b373'),
  ('wpgeared_customers_2026_07', 'c0e2744264b700b22d7cbb2cd9fe2437640a2bff63dbc1e861a794554dabd8c4'),
  ('wpgeared_customers_2026_07', 'e4a939a69a89caa0b3227f106ae18b054edd102f24624aa42f118f33dd0734c7'),
  ('wpgeared_customers_2026_07', '61a0b01b1756261aa5195f22dfb6d7b215f95c104dd94e7a20dd6e082352dc70'),
  ('wpgeared_customers_2026_07', 'd1e59f322f0b42a6394484dfbcdf8eb94cde565208f32738d05d1eab8e121648'),
  ('wpgeared_customers_2026_07', '3431db502a0c7435c04e6ba5ef6d27b570c8ec7c40b80c0fd70e2a92cbae8722'),
  ('wpgeared_customers_2026_07', '893b1f61fbd6e691736ee12db01e67923aa2ba0abf45f15dc47b5ccb3661d92b'),
  ('wpgeared_customers_2026_07', 'a4b81446749eac7d88323f7b52040444ce4babbda13ef4e3653a966c3a34e77a'),
  ('wpgeared_customers_2026_07', '9206a0b207b2d1348c792feb3aa075e1b747f87183d23f4079fc7fe5b05e2ec8'),
  ('wpgeared_customers_2026_07', 'c8d30c9bf6f14cd4c0cdd5ef11b81c1dbfc0c375867ac10448797421614e5962'),
  ('wpgeared_customers_2026_07', 'e19889dd68aaa845ea5c63e362d5591bb4eb2ef79d6dc8e2937edf0157b28348'),
  ('wpgeared_customers_2026_07', '6e16cdef9b63847bf4964af8ca19edd85c628f7e4d5ada22eedd992671a8009c'),
  ('wpgeared_customers_2026_07', '004b62c5577da922e5b225e21e41352c358b4407e11e98d6ddad4c8f5fd8a046'),
  ('wpgeared_customers_2026_07', 'ce75b004f0773c33f42999b4008b1a5ca63d3c86407b359762b8874d7246fe19'),
  ('wpgeared_customers_2026_07', 'bfdf28209b727bcdcc35e81038f312580ba90b1197998f3c698a8580bb2d46de'),
  ('wpgeared_customers_2026_07', 'd0896220a069342ad091aa3fecf3fe810a5c9bc5b1e85098e429c8e461db94a8'),
  ('wpgeared_customers_2026_07', 'b0869ea57aaa9237543956bb07e2cd3c8730c287d5d26349cd4ab386e09f7ce0'),
  ('wpgeared_customers_2026_07', 'fa0ba1269e91f500ea67d0a6b5e3e14cd1029340fb6cff1c6ab888dfa871a563'),
  ('wpgeared_customers_2026_07', '8708ef19368c42ee2b8abf2b92a7f039b4e254cb3b40cc29696b8c20dda30c74'),
  ('wpgeared_customers_2026_07', '56000ba80586fdfffc0daedf6404a7313bcf7bdb611a842893ea1864cea0d463'),
  ('wpgeared_customers_2026_07', '2e3bd2696b4b46ed61985403c237a9a7d1a1882cfa79a67e9f81a7e33ff71275'),
  ('wpgeared_customers_2026_07', '35d7a2b47b7a2142f99e554c36061531906ccd0afc7cb702d8f3d76e56afff9c'),
  ('wpgeared_customers_2026_07', '6f3302e968fa3d9245c8f9d4a4f09c3e140c1d571ee5d1345d2bd4bd2dab729a'),
  ('wpgeared_customers_2026_07', '919dc4d2b1eb538b775cb4e9d014f24fc0b4edf7b77f5be98e5cedd1da22739f'),
  ('wpgeared_customers_2026_07', '0eae99a7627886a1492e7e2c5bef1dc68d8337d27c35e42728fe8adbdd34bcb4'),
  ('wpgeared_customers_2026_07', '35d2cb66f6a4c782151692a14d3b8c9aa904acf8a8698e867b59ef48c2e3db19'),
  ('wpgeared_customers_2026_07', '4638ff50be455bd68ab641c50c4c4e5f7e2dc28a753713bdbd548d1f6614f3a7'),
  ('wpgeared_customers_2026_07', '1495bc592ba92987c583f831263340d3dc996ff13ccde4738867e50bdb4c1c0d'),
  ('wpgeared_customers_2026_07', 'e508244be391e9447f829e044f6ab841b6e90c3952e10e38aa0c15186ee5b3f9'),
  ('wpgeared_customers_2026_07', '5d2e63880a328be4d600f8511d1462bc8bed2e729713a2a62554654b2a23ab0b'),
  ('wpgeared_customers_2026_07', 'cb1874121fde4a3e3279c04ac5eca172d044c133aad7917dc722a9392df71336'),
  ('wpgeared_customers_2026_07', 'e4243e1a91ae4630b5d7852de17e50b29388ca221edfbe4680622a37dc7f6f04'),
  ('wpgeared_customers_2026_07', 'e55e1e55594b0fd8b8737b7e21021a43967ee213c76c9113711d4cef83189949'),
  ('wpgeared_customers_2026_07', '416c72225cfaf8ec452cb751f66dd0fdb5182296c668cee05ddef03890182a59')
on conflict (campaign, email_hash) do nothing;

create or replace function public.claim_wpgeared_customer_offer()
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  campaign_key constant text := 'wpgeared_customers_2026_07';
  award_amount constant integer := 1000;
  caller_user_id uuid := auth.uid();
  caller_email text;
  caller_email_confirmed_at timestamptz;
  caller_email_hash text;
  eligibility_row public.campaign_offer_eligibility%rowtype;
  profile_plan text;
  new_credits_remaining integer;
  new_bonus_credits_remaining integer;
begin
  if caller_user_id is null then
    return json_build_object(
      'success', false,
      'status', 'authentication_required',
      'message', 'Please sign in before claiming this offer.'
    );
  end if;

  select u.email, u.email_confirmed_at
  into caller_email, caller_email_confirmed_at
  from auth.users u
  where u.id = caller_user_id;

  if caller_email is null or caller_email_confirmed_at is null then
    return json_build_object(
      'success', false,
      'status', 'confirmed_email_required',
      'message', 'Please confirm your email address before claiming this offer.'
    );
  end if;

  caller_email_hash := encode(
    extensions.digest(lower(btrim(caller_email)), 'sha256'),
    'hex'
  );

  select e.*
  into eligibility_row
  from public.campaign_offer_eligibility e
  where e.campaign = campaign_key
    and e.email_hash = caller_email_hash
  for update;

  if not found then
    return json_build_object(
      'success', false,
      'status', 'not_eligible',
      'message', 'This offer is available only to invited WPGeared customers using their invited email address.'
    );
  end if;

  if eligibility_row.claimed_at is not null then
    select p.credits_remaining, p.bonus_credits_remaining
    into new_credits_remaining, new_bonus_credits_remaining
    from public.profiles p
    where p.id = caller_user_id;

    return json_build_object(
      'success', true,
      'status', 'already_claimed',
      'message', 'This customer offer has already been claimed.',
      'credits_awarded', eligibility_row.credits_awarded,
      'credits_remaining', new_credits_remaining,
      'bonus_credits_remaining', new_bonus_credits_remaining
    );
  end if;

  select p.subscription_plan
  into profile_plan
  from public.profiles p
  where p.id = caller_user_id
  for update;

  if not found then
    return json_build_object(
      'success', false,
      'status', 'profile_not_found',
      'message', 'Your Alt Text Pro profile is not ready yet. Please sign out and sign in again.'
    );
  end if;

  if coalesce(profile_plan, 'free') <> 'free' then
    return json_build_object(
      'success', false,
      'status', 'free_plan_required',
      'message', 'This 1,000-credit customer bonus is available on a free Alt Text Pro account.'
    );
  end if;

  update public.profiles
  set
    credits_remaining = coalesce(credits_remaining, 0) + award_amount,
    bonus_credits_remaining = coalesce(bonus_credits_remaining, 0) + award_amount,
    updated_at = now()
  where id = caller_user_id
  returning credits_remaining, bonus_credits_remaining
  into new_credits_remaining, new_bonus_credits_remaining;

  update public.campaign_offer_eligibility
  set
    claimed_by = caller_user_id,
    claimed_at = now(),
    credits_awarded = award_amount
  where campaign = campaign_key
    and email_hash = caller_email_hash;

  insert into public.audit_logs (
    actor_id,
    actor_email,
    action,
    resource_type,
    resource_id,
    details,
    severity
  )
  values (
    caller_user_id,
    caller_email,
    'credit.add',
    'campaign_offer',
    campaign_key,
    jsonb_build_object(
      'credits_awarded', award_amount,
      'credits_remaining', new_credits_remaining,
      'bonus_credits_remaining', new_bonus_credits_remaining
    ),
    'info'
  );

  return json_build_object(
    'success', true,
    'status', 'claimed',
    'message', 'Your 1,000 bonus credits have been added.',
    'credits_awarded', award_amount,
    'credits_remaining', new_credits_remaining,
    'bonus_credits_remaining', new_bonus_credits_remaining
  );
end;
$function$;

revoke all on function public.claim_wpgeared_customer_offer()
  from public, anon, authenticated;
grant execute on function public.claim_wpgeared_customer_offer()
  to authenticated;

-- Promotional credits remain available after a monthly plan allowance is used.
create or replace function public.use_credit(
  user_uuid uuid,
  alt_text text,
  context text default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_credits integer;
  current_bonus_credits integer;
  current_total_processed integer;
  current_plan text;
  current_monthly_allowance integer;
  current_credits_last_renewed_at timestamptz;
  plan_credits integer;
  monthly_limit integer;
  plan_credits_remaining integer;
  use_bonus_credit boolean := false;
  new_credits integer;
  new_bonus_credits integer;
  new_total_processed integer;
  usable_credits_remaining integer;
  usage_log_id uuid;
begin
  if user_uuid is null then
    return json_build_object('error', 'User UUID is required');
  end if;

  select
    p.credits_remaining,
    p.bonus_credits_remaining,
    p.total_processed,
    p.subscription_plan,
    p.monthly_credit_allowance,
    p.credits_last_renewed_at,
    sp.credits
  into
    current_credits,
    current_bonus_credits,
    current_total_processed,
    current_plan,
    current_monthly_allowance,
    current_credits_last_renewed_at,
    plan_credits
  from public.profiles p
  left join public.subscription_plans sp on sp.id = p.subscription_plan
  where p.id = user_uuid
  for update of p;

  if current_credits is null then
    return json_build_object('error', 'User not found');
  end if;

  current_bonus_credits := coalesce(current_bonus_credits, 0);

  if current_credits <= 0 then
    return json_build_object(
      'error', 'No credits remaining',
      'credits_remaining', current_credits,
      'bonus_credits_remaining', current_bonus_credits
    );
  end if;

  if current_plan in ('free', 'tier1', 'tier2', 'tier3', 'lite', 'standard', 'pro') then
    monthly_limit := coalesce(nullif(current_monthly_allowance, 0), plan_credits, 0);

    select coalesce(sum(credits_used), 0)::integer
    into current_total_processed
    from public.usage_logs
    where user_id = user_uuid
      and created_at >= coalesce(
        current_credits_last_renewed_at,
        date_trunc('month', now())
      );

    plan_credits_remaining := greatest(
      0,
      monthly_limit - coalesce(current_total_processed, 0)
    );
    use_bonus_credit := plan_credits_remaining <= 0
      and current_bonus_credits > 0;

    if plan_credits_remaining <= 0 and not use_bonus_credit then
      return json_build_object(
        'error', 'Monthly credits exhausted',
        'credits_remaining', current_credits,
        'bonus_credits_remaining', current_bonus_credits,
        'total_processed', coalesce(current_total_processed, 0),
        'monthly_credit_limit', monthly_limit,
        'monthly_credits_remaining', 0
      );
    end if;
  else
    use_bonus_credit := current_bonus_credits > 0;
  end if;

  new_credits := current_credits - 1;
  new_bonus_credits := case
    when use_bonus_credit then current_bonus_credits - 1
    else current_bonus_credits
  end;
  new_total_processed := coalesce(current_total_processed, 0) + 1;

  update public.profiles
  set
    credits_remaining = new_credits,
    bonus_credits_remaining = new_bonus_credits,
    total_processed = new_total_processed,
    updated_at = now()
  where id = user_uuid;

  insert into public.usage_logs (
    user_id,
    credits_used,
    alt_text_generated,
    image_context
  )
  values (user_uuid, 1, alt_text, context)
  returning id into usage_log_id;

  usable_credits_remaining := case
    when monthly_limit > 0 then least(
      new_credits,
      greatest(0, monthly_limit - new_total_processed) + new_bonus_credits
    )
    else new_credits
  end;

  return json_build_object(
    'success', true,
    'credits_used', 1,
    'credits_remaining', new_credits,
    'bonus_credits_remaining', new_bonus_credits,
    'total_processed', new_total_processed,
    'monthly_credit_limit', monthly_limit,
    'monthly_credits_remaining', usable_credits_remaining,
    'usage_log_id', usage_log_id
  );
exception
  when others then
    raise warning 'Error in use_credit for user %: %', user_uuid, sqlerrm;
    return json_build_object(
      'error', 'Database error during credit deduction',
      'success', false
    );
end;
$function$;

revoke all on function public.use_credit(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.use_credit(uuid, text, text)
  to service_role;

-- Free-plan renewal restores the normal 30-credit allowance without deleting
-- any unspent promotional credits.
create or replace function public.renew_monthly_credits()
returns table (
  renewed_count integer,
  renewed_user_ids uuid[]
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  renewed_users uuid[];
  renewal_count integer := 0;
begin
  with renewed as (
    update public.profiles
    set
      credits_remaining = 30 + bonus_credits_remaining,
      credits_last_renewed_at = now(),
      updated_at = now()
    where subscription_plan = 'free'
      and subscription_status = 'active'
      and (
        credits_last_renewed_at is null
        or credits_last_renewed_at <= now() - interval '30 days'
      )
    returning id
  )
  select array_agg(id), count(*)::integer
  into renewed_users, renewal_count
  from renewed;

  return query
  select
    renewal_count,
    coalesce(renewed_users, array[]::uuid[]);
end;
$function$;

revoke all on function public.renew_monthly_credits()
  from public, anon, authenticated;
grant execute on function public.renew_monthly_credits()
  to service_role;
