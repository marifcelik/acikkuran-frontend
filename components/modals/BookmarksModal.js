import dayjs from "dayjs";
import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en";
import { useSession } from "next-auth/react";
import { Trans, useTranslation } from "next-i18next";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  RiBook3Line,
  RiBookmark2Fill,
  RiBookmark2Line,
  RiBookmarkFill,
  RiBookmarkLine,
  RiMoreFill,
  RiQuillPenLine,
} from "react-icons/ri";
import { Tooltip } from "react-tippy";
import { useRecoilState } from "recoil";

import Button from "@components/common/Button";
import LoadingBar from "@components/common/LoadingBar";
import VerseExpand from "@components/ui/VerseExpand";
import { modalState } from "@recoil/atoms";
import {
  BookmarkAction,
  BookmarkContainer,
  BookmarkContextMenu,
  BookmarkDate,
  BookmarkEditForm,
  BookmarkEmpty,
  BookmarkLabels,
  BookmarkList,
  BookmarkLoading,
  BookmarkNotes,
  BookmarkSearchContainer, // Added
  BookmarkSearchInput,   // Added
  BookmarkEditActions,   // Added
  BookmarkVerse,
  BookmarkVerseArabic,
  BookmarkVerseNumber,
  BookmarkVerseTranscription,
  BookmarkVerseTranslation,
} from "@styles/bookmark.style";
import { fetchJson } from "@utils/funcs";
import tr from "@utils/javascriptTimeAgo/tr";

import BaseModal from "./BaseModal";

const BookmarksModal = (props) => {
  const router = useRouter();
  const locale = process.env.NEXT_PUBLIC_LOCALE;

  const langs = {
    tr,
    en,
  };

  TimeAgo.addLocale(langs[locale]);
  const timeAgo = new TimeAgo(locale);

  const { t } = useTranslation("common");

  const { modalKey, authorId } = props;

  const title = t("bookmark__title");
  const { data: session } = useSession();

  const [bookmarks, setBookmarks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoginRequired, setIsLoginRequired] = useState(false);
  const [_, setModalInfo] = useRecoilState(modalState);
  const [searchTerm, setSearchTerm] = useState("");
  // For per-item editing state:
  // editingStates will store { bookmarkId: { notes: string, labels: string[] } }
  const [editingStates, setEditingStates] = useState({});

  const MODAL_WIDTH = 900;

  const handleRemoveBookmark = async (bookmarkKey) => {
    const values = {
      bookmarkKey,
      action: "remove",
    };

    toast.promise(
      fetch(`/api/bookmark`, {
        method: "POST",
        body: JSON.stringify(values),
      }).then((res) => {
        if (res.ok) {
          setBookmarks(
            bookmarks.filter((bookmark) => bookmark.bookmarkKey !== bookmarkKey)
          );
          return Promise.resolve();
        } else {
          return Promise.reject();
        }
      }),

      {
        loading: t("bookmark__remove_loading"),
        success: t("bookmark__remove_success"),
        error: t("bookmark__remove_error"),
      },
      {
        success: {
          icon: <RiBookmark2Fill />,
        },
        error: {
          icon: <RiBookmarkFill color="#c20000" />,
        },
      }
    );
  };

  const getBookmarks = async (term = "") => {
    setIsLoading(true);
    const data = await fetchJson(
      `/api/bookmarks?author=${authorId}&searchTerm=${term}`
    );
    data?.users_bookmarks && setBookmarks(data?.users_bookmarks);
    setIsLoading(false);
  };

  useEffect(() => {
    if (session?.user?.id) {
      getBookmarks(searchTerm);
    } else {
      setIsLoading(false);
      setIsLoginRequired(true);
    }
  }, [session, searchTerm]); // Re-fetch if session or searchTerm changes

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  // Basic debounce for search
  useEffect(() => {
    const handler = setTimeout(() => {
      if (session?.user?.id) {
        getBookmarks(searchTerm);
      }
    }, 500); // 500ms debounce

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, session, authorId]); // Added authorId as a dependency

  // --- Edit, Save, Cancel Handlers for per-item state ---
  const handleEdit = (bookmark) => {
    setEditingStates((prev) => ({
      ...prev,
      [bookmark.id]: {
        notes: bookmark.notes || "",
        labels: bookmark.labels || [],
      },
    }));
  };

  const handleCancelEdit = (bookmarkId) => {
    setEditingStates((prev) => {
      const newState = { ...prev };
      delete newState[bookmarkId];
      return newState;
    });
  };

  const handleNoteChange = (bookmarkId, newNotes) => {
    setEditingStates((prev) => ({
      ...prev,
      [bookmarkId]: {
        ...(prev[bookmarkId] || {}),
        notes: newNotes,
      },
    }));
  };

  const handleLabelsChange = (bookmarkId, newLabelsString) => {
    const newLabelsArray = newLabelsString.split(",").map(s => s.trim()).filter(s => s);
    setEditingStates((prev) => ({
      ...prev,
      [bookmarkId]: {
        ...(prev[bookmarkId] || {}),
        labels: newLabelsArray,
      },
    }));
  };

  const handleSave = async (bookmarkToSave) => {
    const editState = editingStates[bookmarkToSave.id];
    if (!editState) return; // Should not happen if UI is correct

    const verseId = bookmarkToSave.verse?.id || bookmarkToSave.verse_id;
    if (!verseId) {
      toast.error(t("bookmark__error_missing_verse_id", "Missing verse information to save."));
      return;
    }

    const values = {
      bookmarkKey: bookmarkToSave.bookmarkKey,
      action: "add",
      verseId: verseId,
      type: bookmarkToSave.type,
      bookmarkItem: bookmarkToSave.bookmarkItem,
      labels: editState.labels,
      notes: editState.notes,
    };

    toast.promise(
      fetch(`/api/bookmark`, {
        method: "POST",
        body: JSON.stringify(values),
      }).then(async (res) => {
        if (res.ok) {
          setBookmarks(
            bookmarks.map((b) =>
              b.id === bookmarkToSave.id
                ? { ...b, notes: editState.notes, labels: editState.labels, updated_at: new Date().toISOString() }
                : b
            )
          );
          handleCancelEdit(bookmarkToSave.id); // Exit edit mode for this item
          return Promise.resolve();
        } else {
          const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
          return Promise.reject(new Error(errorData.error || t("bookmark__save_error_detailed", "Failed to save. Please try again.")));
        }
      }),
      {
        loading: t("bookmark__save_loading", "Saving..."),
        success: t("bookmark__save_success", "Bookmark saved!"),
        error: (err) => err.message || t("bookmark__save_error", "Error saving bookmark!"),
      },
      {
        success: { icon: <RiBookmark2Fill /> },
        error: { icon: <RiBookmarkFill color="#c20000" /> },
      }
    );
  };

  return (
    <BaseModal
      title={title}
      modalKey={modalKey}
      width={MODAL_WIDTH}
      fullscreen
      contentStyle={{ padding: 0 }}
    >
      <BookmarkContainer>
        <BookmarkSearchContainer>
          <BookmarkSearchInput
            type="text"
            placeholder={t("bookmark__search_placeholder", "Search bookmarks...")}
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </BookmarkSearchContainer>
        {isLoading ? (
          <BookmarkLoading>
            <LoadingBar />
          </BookmarkLoading>
        ) : (
          <BookmarkList>
            {!bookmarks.length && searchTerm ? (
               <BookmarkEmpty>
                 <h2>{t("bookmark__no_results_title", "No Results Found")}</h2>
                 <p>{t("bookmark__no_results_desc", "Try adjusting your search term.")}</p>
               </BookmarkEmpty>
            ) : !bookmarks.length && !isLoginRequired ? (
              <BookmarkEmpty>
                 <>
                    <h2>{t("bookmark__no_bookmark_title")}</h2>
                    <p>
                      <Trans
                        i18nKey="bookmark__no_bookmark_desc"
                        components={{ icon: <RiBookmarkLine /> }}
                      />
                    </p>
                  </>
                  <div className="additional_text">
                  <div>
                    <span>—</span>
                  </div>
                  <span>{t("bookmark__no_bookmark_desc_2")} </span>
                </div>
              </BookmarkEmpty>
            ) : !bookmarks.length && isLoginRequired ? (
               <BookmarkEmpty>
                  <>
                    <h2>
                      <RiBookmarkLine size="42" />
                    </h2>
                    <p
                      dangerouslySetInnerHTML={{
                        __html: t("bookmark__login_required"),
                      }}
                    ></p>
                    <p>
                      <Button
                        type="button"
                        fullWidth
                        onClick={() => setModalInfo({ openedModal: "login" })}
                      >
                        {t("login__direction_text")}
                      </Button>
                    </p>
                  </>
                </BookmarkEmpty>
            ) : (
              bookmarks.map((bookmark) => {
                const surahNames = {
                  tr: bookmark.verse.surah.name,
                  en: bookmark.verse.surah.name_en,
                };
                // Check if the current bookmark is being edited
                const isCurrentlyEditing = !!editingStates[bookmark.id];
                const currentEditState = editingStates[bookmark.id] || { notes: '', labels: [] };

                return (
                  <BookmarkVerse key={bookmark.id}>
                    <BookmarkVerseNumber>
                      <Link
                        href={`/[surah_id]/[verse_number]`}
                        as={`/${bookmark.verse.surah.id}/${bookmark.verse.verse_number}`}
                        onClick={() => {
                          setModalInfo({ openedModal: null });
                        }}
                      >
                        {t("search__translation_verse_line", {
                          surah_id: bookmark.verse.surah.id,
                          surah_name: surahNames[locale],
                          verse_number: bookmark.verse.verse_number,
                        })}
                      </Link>
                      <BookmarkAction>
                        <BookmarkDate
                          dateTime={bookmark.updated_at}
                          title={dayjs(bookmark.updated_at).format(
                            "DD.MM.YYYY HH:mm:ss"
                          )}
                        >
                          {timeAgo.format(
                            dayjs(bookmark.updated_at).toDate(),
                            "twitter-minute-now"
                          )}
                        </BookmarkDate>
                        <Tooltip
                          interactive
                          tag="span"
                          html={
                            <BookmarkContextMenu>
                              <ul className="tippy-list">
                                <li
                                  onClick={() =>
                                    handleRemoveBookmark(bookmark.bookmarkKey)
                                  }
                                >
                                  <RiBookmark2Line />{" "}
                                  {t("context_menu__remove_bookmark")}
                                </li>
                                <li
                                  onClick={() => {
                                    router.push(
                                      `/${bookmark.verse.surah.id}/${bookmark.verse.verse_number}`
                                    );
                                    setModalInfo({ openedModal: null });
                                  }}
                                >
                                  <RiQuillPenLine />{" "}
                                  {t("context_menu__go_to_verse_detail")}
                                </li>
                                <li
                                  onClick={() => {
                                    router.push(
                                      `/page/${bookmark.verse.page}#${bookmark.verse.surah.id}:${bookmark.verse.verse_number}`
                                    );
                                    setModalInfo({ openedModal: null });
                                  }}
                                >
                                  <RiBook3Line />{" "}
                                  {t("context_menu__go_to_page")}
                                </li>
                              </ul>
                            </BookmarkContextMenu>
                          }
                          theme="light"
                          position="bottom"
                          trigger="click"
                          animation="shift"
                          arrow={true}
                          duration="150"
                        >
                          <RiMoreFill />
                        </Tooltip>
                      </BookmarkAction>
                    </BookmarkVerseNumber>
                    <BookmarkVerseTranslation>
                      <VerseExpand
                        translation={bookmark.verse.translations[0]}
                        showFootnotes={false}
                      />
                    </BookmarkVerseTranslation>
                    <BookmarkVerseArabic>
                      {bookmark.verse.verse}
                    </BookmarkVerseArabic>
                    <BookmarkVerseTranscription>
                      {bookmark.verse.transcription}
                    </BookmarkVerseTranscription>

                    {/* Display Notes and Labels */}
                    {isCurrentlyEditing ? (
                      <BookmarkEditForm>
                        <BookmarkNotes>
                          <label htmlFor={`notes-${bookmark.id}`}>{t("bookmark__notes_label", "Notes")}</label>
                          <textarea
                            id={`notes-${bookmark.id}`}
                            value={currentEditState.notes}
                            onChange={(e) => handleNoteChange(bookmark.id, e.target.value)}
                            placeholder={t("bookmark__notes_placeholder", "Enter your notes...")}
                          />
                        </BookmarkNotes>
                        <BookmarkLabels>
                          <label htmlFor={`labels-${bookmark.id}`}>{t("bookmark__labels_label", "Labels (comma-separated)")}</label>
                          <input
                            type="text"
                            id={`labels-${bookmark.id}`}
                            value={currentEditState.labels.join(", ")}
                            onChange={(e) => handleLabelsChange(bookmark.id, e.target.value)}
                            placeholder={t("bookmark__labels_placeholder", "e.g., reflection, important, to-read")}
                          />
                        </BookmarkLabels>
                      </BookmarkEditForm>
                    ) : (
                      <>
                        {bookmark.notes && (
                          <BookmarkNotes>
                            <strong>{t("bookmark__notes_heading", "Notes:")}</strong>
                            <div className="notes-display-text">{bookmark.notes}</div>
                          </BookmarkNotes>
                        )}
                        {bookmark.labels && bookmark.labels.length > 0 && (
                          <BookmarkLabels>
                            <strong>{t("bookmark__labels_heading", "Labels:")}</strong>
                            <div className="labels-display-container">
                              {bookmark.labels.map((label, index) => (
                                <span key={index} className="label-tag">
                                  {label}
                                </span>
                              ))}
                            </div>
                          </BookmarkLabels>
                        )}
                      </>
                    )}

                    {/* Edit/Save/Cancel Buttons */}
                    <BookmarkEditActions>
                      {isCurrentlyEditing ? (
                        <>
                          <Button onClick={() => handleSave(bookmark)} size="small" disabled={isLoading}>
                            {t("bookmark__save_button", "Save")}
                          </Button>
                          <Button onClick={() => handleCancelEdit(bookmark.id)} variant="secondary" size="small" disabled={isLoading}>
                            {t("bookmark__cancel_button", "Cancel")}
                          </Button>
                        </>
                      ) : (
                        <Button onClick={() => handleEdit(bookmark)} size="small" disabled={isLoading}>
                          {t("bookmark__edit_button", "Edit")}
                        </Button>
                      )}
                    </BookmarkEditActions>
                  </BookmarkVerse>
                );
              })
            )}
          </BookmarkList>
        )}
      </BookmarkContainer>
    </BaseModal>
  );
};

export default BookmarksModal;
