import Image from "next/image";
import {useLocale} from "@/features/i18n/locale-provider";
import s from "./portal.module.css";

export function GuidanceImage(){const {t}=useLocale();return <figure className={s.guidePhoto}>
  <Image src="/v2-workspace/logistics-yard.webp" width={1200} height={600} sizes="(max-width: 767px) 100vw, 65vw" alt=""/>
  <figcaption><span>{t("Imagen ilustrativa · no representa una sede registrada","Illustrative image · not a registered facility")}</span><a href="https://www.pexels.com/photo/containers-in-warehouse-24244230/" target="_blank" rel="noreferrer">{t("Foto: Diego F. Parra / Pexels","Photo: Diego F. Parra / Pexels")}</a></figcaption>
</figure>;}
